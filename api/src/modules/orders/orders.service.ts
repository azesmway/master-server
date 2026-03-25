import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order, OrderResponse, OrderStatus, OrderType, ResponseStatus } from './entities/order.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { User } from '../users/entities/user.entity';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, CreateResponseDto, UpdateBarterResponseDto } from './dto';

export interface OrderFilter {
  clientId?:   string;
  categoryId?: string;
  city?:       string;
  status?:     OrderStatus;
  type?:       OrderType;
  page?:       number;
  limit?:      number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderResponse)
    private readonly responseRepo: Repository<OrderResponse>,

    @InjectRepository(Specialist)
    private readonly specialistRepo: Repository<Specialist>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly chatService: ChatService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Orders ────────────────────────────────────────────────

  async findAll(filter: OrderFilter, viewerRole?: string) {
    const { clientId, categoryId, city, status, type, page = 1, limit = 20 } = filter;

    const where: any = {};
    if (clientId)   where.clientId   = clientId;
    if (categoryId) where.categoryId = categoryId;
    if (city)       where.city       = city;
    if (type)       where.type       = type;

    if (viewerRole === 'specialist' && !clientId) {
      where.status = OrderStatus.PUBLISHED;
    } else if (status) {
      where.status = status;
    }

    const [orders, total] = await this.orderRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    const clientIds = [...new Set(orders.map((o) => o.clientId))];
    const clients   = clientIds.length
      ? await this.userRepo.findBy({ id: In(clientIds) })
      : [];
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

    const data = orders.map((o) => ({ ...o, client: clientMap[o.clientId] }));

    return { data, meta: { page, limit, total } };
  }

  async findOne(id: string): Promise<any> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Заказ не найден');

    const client = await this.userRepo.findOne({ where: { id: order.clientId } });

    const responses = await this.responseRepo.find({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });

    const specialistIds = [...new Set(responses.map((r) => r.specialistId))];
    const specialists   = specialistIds.length
      ? await this.specialistRepo.find({ where: { id: In(specialistIds) } })
      : [];

    const userIds = [...new Set(specialists.map((s) => s.userId))];
    const users   = userIds.length
      ? await this.userRepo.findBy({ id: In(userIds) })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const specMap = Object.fromEntries(
      specialists.map((s) => [s.id, { ...s, user: userMap[s.userId] }]),
    );

    const enrichedResponses = responses.map((r) => ({
      ...r,
      specialist: specMap[r.specialistId],
    }));

    return { ...order, client, responses: enrichedResponses };
  }

  async create(clientId: string, dto: CreateOrderDto): Promise<Order> {
    const order = this.orderRepo.create({
      clientId,
      title:                   dto.title,
      description:             dto.description,
      categoryId:              dto.categoryId,
      budgetFrom:              dto.budgetFrom,
      budgetTo:                dto.budgetTo,
      budgetCurrency:          dto.budgetCurrency ?? 'KZT',
      budgetUnit:              dto.budgetUnit ?? 'project',
      city:                    dto.city,
      address:                 dto.address,
      photos:                  dto.photos ?? [],
      deadline:                dto.deadline,
      status:                  OrderStatus.PUBLISHED,
      type:                    dto.type ?? OrderType.STANDARD,
      // Partner
      partnerId:               dto.partnerId,
      partnerCommissionPercent: dto.partnerCommissionPercent,
      partnerClientName:       dto.partnerClientName,
      partnerClientPhone:      dto.partnerClientPhone,
      // Barter
      barterClientOffer:       dto.barterClientOffer,
    });
    return this.orderRepo.save(order);
  }

  async updateStatus(id: string, clientId: string, status: OrderStatus): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа');
    await this.orderRepo.update(id, { status });

    // Считаем партнёрскую комиссию при завершении
    if (status === OrderStatus.COMPLETED && order.partnerId && order.partnerCommissionPercent && order.budgetFrom) {
      const partnerCommissionAmount = Math.floor(order.budgetFrom * order.partnerCommissionPercent / 100);
      const platformCutAmount       = Math.floor(partnerCommissionAmount * 0.10);
      await this.orderRepo.update(id, { partnerCommissionAmount, platformCutAmount });
    }

    return this.orderRepo.findOne({ where: { id } }) as Promise<Order>;
  }

  async delete(id: string, clientId: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа');
    await this.orderRepo.update(id, { status: OrderStatus.CANCELLED });
  }

  // ── Responses ─────────────────────────────────────────────

  async createResponse(
    orderId: string,
    userId:  string,
    dto:     CreateResponseDto,
  ): Promise<OrderResponse> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status !== OrderStatus.PUBLISHED) {
      throw new BadRequestException('Заказ недоступен для откликов');
    }

    const specialist = await this.specialistRepo.findOne({ where: { userId } });
    if (!specialist) throw new BadRequestException('Создайте профиль специалиста');

    const existing = await this.responseRepo.findOne({
      where: { orderId, specialistId: specialist.id },
    });
    if (existing) throw new BadRequestException('Вы уже откликнулись');

    const response = this.responseRepo.create({
      orderId,
      specialistId: specialist.id,
      message:      dto.message,
      price:        dto.price,
      currency:     dto.currency ?? 'KZT',
      status:       ResponseStatus.PENDING,
    });

    await this.responseRepo.save(response);
    await this.orderRepo.increment({ id: orderId }, 'responseCount', 1);

    try {
      const spec     = await this.specialistRepo.findOne({ where: { id: response.specialistId } });
      const specUser = spec ? await this.userRepo.findOne({ where: { id: spec.userId } }) : null;
      if (specUser && order.clientId) {
        await this.notificationsService.sendNewResponse(
          order.clientId,
          specUser.name ?? 'Специалист',
          order.title,
          orderId,
        );
      }
    } catch (e) {}

    return response;
  }

  async acceptResponse(
    responseId: string,
    clientId:   string,
  ): Promise<{ response: OrderResponse; roomId: string }> {
    const response = await this.responseRepo.findOne({ where: { id: responseId } });
    if (!response) throw new NotFoundException('Отклик не найден');

    const order = await this.orderRepo.findOne({ where: { id: response.orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа');

    const specialist = await this.specialistRepo.findOne({
      where: { id: response.specialistId },
    });
    if (!specialist) throw new NotFoundException('Специалист не найден');

    await this.responseRepo.update(responseId, { status: ResponseStatus.ACCEPTED });
    await this.orderRepo.update(response.orderId, { status: OrderStatus.IN_PROGRESS });

    await this.responseRepo
      .createQueryBuilder()
      .update(OrderResponse)
      .set({ status: ResponseStatus.REJECTED })
      .where('orderId = :orderId AND id != :id', { orderId: response.orderId, id: responseId })
      .execute();

    const room = await this.chatService.getOrCreateRoom(
      [clientId, specialist.userId],
      response.orderId,
    );

    try {
      await this.notificationsService.sendResponseAccepted(
        specialist.userId,
        order.title,
        room.id,
      );
    } catch (e) {}

    return { response, roomId: room.id };
  }

  async getMyResponses(specialistUserId: string) {
    const specialist = await this.specialistRepo.findOne({
      where: { userId: specialistUserId },
    });
    if (!specialist) return { data: [] };

    const responses = await this.responseRepo.find({
      where: { specialistId: specialist.id },
      order: { createdAt: 'DESC' },
    });

    const orderIds = [...new Set(responses.map((r) => r.orderId))];
    const orders   = orderIds.length
      ? await this.orderRepo.findBy({ id: In(orderIds) })
      : [];
    const orderMap = Object.fromEntries(orders.map((o) => [o.id, o]));

    const data = responses.map((r) => ({ ...r, order: orderMap[r.orderId] }));
    return { data };
  }

  // ── Nearby ────────────────────────────────────────────────

  async findNearby(lat: number, lng: number, radiusKm = 10, limit = 5) {
    const orders = await this.orderRepo.query(`
      SELECT o.*,
        (6371 * acos(
          cos(radians($1)) * cos(radians(CAST(o.lat AS float))) *
          cos(radians(CAST(o.lng AS float)) - radians($2)) +
          sin(radians($1)) * sin(radians(CAST(o.lat AS float)))
        )) AS distance_km
      FROM orders o
      WHERE o.status = 'published'
        AND o.lat IS NOT NULL
        AND o.lng IS NOT NULL
        AND (6371 * acos(
          cos(radians($1)) * cos(radians(CAST(o.lat AS float))) *
          cos(radians(CAST(o.lng AS float)) - radians($2)) +
          sin(radians($1)) * sin(radians(CAST(o.lat AS float)))
        )) < $3
      ORDER BY distance_km ASC
      LIMIT $4
    `, [lat, lng, radiusKm, limit]);

    return {
      data: orders.map((o: any) => ({
        ...o,
        distanceKm: parseFloat(o.distance_km),
      })),
    };
  }

  // ── Partner ───────────────────────────────────────────────

  async getPartnerOrders(partnerId: string, page = 1, limit = 20) {
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { partnerId },
      order: { createdAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
    });
    return { data: orders, meta: { page, limit, total } };
  }

  async markPartnerPaid(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    await this.orderRepo.update(orderId, { partnerPaid: true });
    return this.orderRepo.findOne({ where: { id: orderId } });
  }

  // ── Barter ────────────────────────────────────────────────

  async updateBarterResponse(
    responseId:    string,
    specialistUserId: string,
    dto:           UpdateBarterResponseDto,
  ) {
    const response = await this.responseRepo.findOne({ where: { id: responseId } });
    if (!response) throw new NotFoundException('Отклик не найден');

    const specialist = await this.specialistRepo.findOne({ where: { userId: specialistUserId } });
    if (!specialist || response.specialistId !== specialist.id) {
      throw new ForbiddenException('Нет доступа');
    }

    await this.orderRepo.update(response.orderId, {
      barterSpecialistWant: dto.barterSpecialistWant,
      barterPlatformFee:    dto.barterPlatformFee,
    });

    return this.orderRepo.findOne({ where: { id: response.orderId } });
  }
}
