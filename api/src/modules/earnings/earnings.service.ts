import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { Earning, EarningStatus, EarningType } from './earnings.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';

const COMMISSION_RATE = 0.08; // 8%

@Injectable()
export class EarningsService {
  constructor(
    @InjectRepository(Earning)
    private readonly earningRepo: Repository<Earning>,

    @InjectRepository(Specialist)
    private readonly specRepo: Repository<Specialist>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  // Создать запись о заработке при завершении заказа
  async createFromOrder(orderId: string, specialistId: string, amount: number): Promise<Earning> {
    const commission = Math.round(amount * COMMISSION_RATE);
    const net        = amount - commission;

    const earning = this.earningRepo.create({
      specialistId,
      orderId,
      amount,
      commission,
      net,
      currency:    'KZT',
      type:        EarningType.ORDER,
      status:      EarningStatus.AVAILABLE,
      description: 'Оплата за выполненный заказ',
    });

    await this.earningRepo.save(earning);

    // Обновляем счётчик выполненных заказов
    await this.specRepo.increment({ id: specialistId }, 'completedOrders', 1);

    return earning;
  }

  // Статистика заработка специалиста
  async getStats(specialistUserId: string) {
    const specialist = await this.specRepo.findOne({
      where: { userId: specialistUserId },
    });
    if (!specialist) return null;

    const now    = new Date();
    const month  = new Date(now.getFullYear(), now.getMonth(), 1);
    const week   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [allTime, thisMonth, thisWeek, pending, history] = await Promise.all([
      // Всего заработано
      this.earningRepo
        .createQueryBuilder('e')
        .select('SUM(e.net)', 'total')
        .addSelect('COUNT(*)', 'count')
        .where('e.specialistId = :id', { id: specialist.id })
        .andWhere('e.status != :s', { s: EarningStatus.PENDING })
        .getRawOne(),

      // За текущий месяц
      this.earningRepo
        .createQueryBuilder('e')
        .select('SUM(e.net)', 'total')
        .where('e.specialistId = :id', { id: specialist.id })
        .andWhere('e.createdAt >= :month', { month })
        .andWhere('e.status != :s', { s: EarningStatus.PENDING })
        .getRawOne(),

      // За неделю
      this.earningRepo
        .createQueryBuilder('e')
        .select('SUM(e.net)', 'total')
        .where('e.specialistId = :id', { id: specialist.id })
        .andWhere('e.createdAt >= :week', { week })
        .andWhere('e.status != :s', { s: EarningStatus.PENDING })
        .getRawOne(),

      // Ожидает
      this.earningRepo
        .createQueryBuilder('e')
        .select('SUM(e.net)', 'total')
        .where('e.specialistId = :id', { id: specialist.id })
        .andWhere('e.status = :s', { s: EarningStatus.PENDING })
        .getRawOne(),

      // История последних 20 транзакций
      this.earningRepo.find({
        where: { specialistId: specialist.id },
        order: { createdAt: 'DESC' },
        take:  20,
      }),
    ]);

    // График по дням (последние 30 дней)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const chartData = await this.earningRepo
      .createQueryBuilder('e')
      .select("DATE(e.createdAt)", 'date')
      .addSelect('SUM(e.net)', 'amount')
      .where('e.specialistId = :id', { id: specialist.id })
      .andWhere('e.createdAt >= :since', { since: thirtyDaysAgo })
      .andWhere('e.status != :s', { s: EarningStatus.PENDING })
      .groupBy("DATE(e.createdAt)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      balance: {
        available: parseFloat(allTime?.total ?? '0'),
        pending:   parseFloat(pending?.total   ?? '0'),
        thisMonth: parseFloat(thisMonth?.total  ?? '0'),
        thisWeek:  parseFloat(thisWeek?.total   ?? '0'),
      },
      stats: {
        totalOrders:    parseInt(allTime?.count ?? '0', 10),
        completedOrders: specialist.completedOrders ?? 0,
        rating:          Number(specialist.rating ?? 0),
        reviewCount:     specialist.reviewCount ?? 0,
      },
      chart:   chartData.map(d => ({
        date:   d.date,
        amount: parseFloat(d.amount ?? '0'),
      })),
      history,
    };
  }

  // Прогноз дохода
  async getForecast(specialistUserId: string) {
    const specialist = await this.specRepo.findOne({
      where: { userId: specialistUserId },
    });
    if (!specialist) return null;

    // Среднее за последние 3 месяца
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const avg = await this.earningRepo
      .createQueryBuilder('e')
      .select('AVG(monthly.total)', 'avgMonthly')
      .from(subQuery => subQuery
        .select("DATE_TRUNC('month', e2.createdAt)", 'month')
        .addSelect('SUM(e2.net)', 'total')
        .from(Earning, 'e2')
        .where('e2.specialistId = :id', { id: specialist.id })
        .andWhere('e2.createdAt >= :since', { since: threeMonthsAgo })
        .groupBy("DATE_TRUNC('month', e2.createdAt)"),
        'monthly',
      )
      .getRawOne();

    const monthlyAvg = parseFloat(avg?.avgMonthly ?? '0');

    return {
      monthlyAvg,
      yearlyForecast: monthlyAvg * 12,
      tips: monthlyAvg < 50000
        ? ['Добавьте портфолио — это увеличивает отклики', 'Отвечайте быстрее для роста рейтинга']
        : ['Рассмотрите повышение цен', 'Попросите клиентов оставить отзывы'],
    };
  }
}
