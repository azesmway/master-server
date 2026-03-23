import {
  BadRequestException, Injectable,
  Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from './payment.entity';
import { Order, OrderStatus, OrderResponse } from '../orders/entities/order.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EarningsService } from '../earnings/earnings.service';

const ESCROW_DAYS    = 7;   // дней до авторелиза
const PLATFORM_FEE   = 0.08; // 8% комиссия

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderResponse)
    private readonly responseRepo: Repository<OrderResponse>,

    private readonly notificationsService: NotificationsService,
    private readonly earningsService:      EarningsService,
  ) {}

  // ── Создать платёж (инициация эскроу) ────────────────────

  async createEscrow(
    orderId:  string,
    clientId: string,
    amount:   number,
    method:   PaymentMethod = PaymentMethod.KASPI,
  ): Promise<{ payment: Payment; kaspiDeeplink?: string }> {

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.clientId !== clientId) throw new BadRequestException('Нет доступа');

    // Проверяем нет ли уже активного платежа
    const existing = await this.paymentRepo.findOne({
      where: { orderId, status: PaymentStatus.HELD },
    });
    if (existing) throw new BadRequestException('Платёж уже создан');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ESCROW_DAYS);

    const payment = await this.paymentRepo.save(this.paymentRepo.create({
      orderId,
      clientId,
      amount,
      currency:  'KZT',
      status:    PaymentStatus.PENDING,
      method,
      expiresAt,
    }));

    // Обновляем статус заказа
    await this.orderRepo.update(orderId, { status: OrderStatus.IN_PROGRESS });

    // Для Kaspi — генерируем deeplink
    let kaspiDeeplink: string | undefined;
    if (method === PaymentMethod.KASPI) {
      kaspiDeeplink = this.generateKaspiDeeplink(payment.id, amount);
    }

    this.logger.log(`[Payment] Создан эскроу ${payment.id} на ${amount}₸`);

    return { payment, kaspiDeeplink };
  }

  // ── Kaspi deeplink ────────────────────────────────────────

  generateKaspiDeeplink(paymentId: string, amount: number): string {
    // Kaspi Pay deeplink формат
    const bin       = process.env.KASPI_BIN ?? '123456789';
    const returnUrl = encodeURIComponent(`https://api.it-trend.dev/v1/payments/kaspi/return?paymentId=${paymentId}`);
    return `kaspi://pay?bin=${bin}&amount=${amount}&orderId=${paymentId}&returnUrl=${returnUrl}`;
  }

  // ── Webhook от Kaspi ──────────────────────────────────────

  async handleKaspiWebhook(body: any): Promise<{ status: string }> {
    const { orderId: paymentId, txnId, status } = body;
    this.logger.log(`[Kaspi Webhook] paymentId=${paymentId} status=${status}`);

    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) return { status: 'not_found' };

    if (status === 'SUCCESS' || status === 'CONFIRMED') {
      await this.paymentRepo.update(paymentId, {
        status:     PaymentStatus.HELD,
        kaspiTxnId: txnId,
      });

      // Уведомляем клиента
      await this.notificationsService.sendToUser(
        payment.clientId,
        '💳 Оплата прошла',
        `Деньги ${Number(payment.amount).toLocaleString()}₸ заморожены в эскроу до завершения работы`,
        { type: 'payment', paymentId },
      );

      this.logger.log(`[Payment] Эскроу подтверждён: ${paymentId}`);
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      await this.paymentRepo.update(paymentId, { status: PaymentStatus.FAILED });
      await this.orderRepo.update(payment.orderId, { status: OrderStatus.PUBLISHED });
    }

    return { status: 'ok' };
  }

  // ── Клиент подтверждает завершение → деньги к специалисту

  async releaseEscrow(orderId: string, clientId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { orderId, status: PaymentStatus.HELD },
    });
    if (!payment) throw new NotFoundException('Платёж не найден');
    if (payment.clientId !== clientId) throw new BadRequestException('Нет доступа');

    await this.paymentRepo.update(payment.id, { status: PaymentStatus.RELEASED });
    await this.orderRepo.update(orderId, { status: OrderStatus.COMPLETED });

    // Находим принятый отклик чтобы узнать specialistId
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    const acceptedResponse = await this.responseRepo.findOne({
      where: { orderId, status: 'accepted' as any },
    });
    const specialistId = acceptedResponse?.specialistId;

    // Создаём запись о заработке
    if (specialistId) {
      await this.earningsService.createFromOrder(
        orderId,
        specialistId,
        Number(payment.amount),
      );
    }

    // Уведомляем стороны
    if (order) {
      await this.notificationsService.sendToUser(
        payment.clientId,
        '✅ Заказ завершён',
        'Спасибо! Деньги переведены специалисту. Оставьте отзыв.',
        { type: 'order_complete', orderId },
      );
    }

    this.logger.log(`[Payment] Эскроу освобождён: ${payment.id}`);
    return this.paymentRepo.findOne({ where: { id: payment.id } }) as Promise<Payment>;
  }

  // ── Возврат клиенту (если специалист не выполнил) ────────

  async refundEscrow(orderId: string, adminId: string, reason: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { orderId, status: PaymentStatus.HELD },
    });
    if (!payment) throw new NotFoundException('Платёж не найден');

    await this.paymentRepo.update(payment.id, { status: PaymentStatus.REFUNDED });
    await this.orderRepo.update(orderId, { status: OrderStatus.CANCELLED });

    await this.notificationsService.sendToUser(
      payment.clientId,
      '↩️ Средства возвращены',
      `Возврат ${Number(payment.amount).toLocaleString()}₸. Причина: ${reason}`,
      { type: 'refund', orderId },
    );

    this.logger.log(`[Payment] Возврат: ${payment.id} — ${reason}`);
    return this.paymentRepo.findOne({ where: { id: payment.id } }) as Promise<Payment>;
  }

  // ── Статус платежа ────────────────────────────────────────

  async getPaymentStatus(orderId: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Список платежей для админа ────────────────────────────

  async findAll(status?: PaymentStatus) {
    return this.paymentRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take:  100,
    });
  }
}
