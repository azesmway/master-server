import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,
  ) {}

  async trackEvents(events: any[]): Promise<void> {
    if (!events?.length) return;
    const entities = events.map(e => this.eventRepo.create({
      event:  e.event,
      userId: e.props?.userId,
      role:   e.props?.role,
      props:  e.props ?? {},
      ts:     e.ts ? new Date(e.ts) : new Date(),
    }));
    await this.eventRepo.save(entities);
  }

  async getDashboard(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalEvents,
      uniqueUsers,
      topEvents,
      dailyActive,
      registrations,
      ordersCreated,
      chatsOpened,
    ] = await Promise.all([
      // Всего событий
      this.eventRepo.count({ where: { ts: MoreThanOrEqual(since) } }),

      // Уникальные пользователи
      this.eventRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.userId)', 'count')
        .where('e.ts >= :since', { since })
        .andWhere('e.userId IS NOT NULL')
        .getRawOne(),

      // Топ событий
      this.eventRepo
        .createQueryBuilder('e')
        .select('e.event', 'event')
        .addSelect('COUNT(*)', 'count')
        .where('e.ts >= :since', { since })
        .groupBy('e.event')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),

      // DAU по дням
      this.eventRepo
        .createQueryBuilder('e')
        .select("DATE(e.ts)", 'date')
        .addSelect('COUNT(DISTINCT e.userId)', 'dau')
        .where('e.ts >= :since', { since })
        .andWhere('e.userId IS NOT NULL')
        .groupBy("DATE(e.ts)")
        .orderBy('date', 'ASC')
        .getRawMany(),

      // Регистрации
      this.eventRepo.count({ where: { event: 'register', ts: MoreThanOrEqual(since) } }),

      // Созданные заказы
      this.eventRepo.count({ where: { event: 'order_create', ts: MoreThanOrEqual(since) } }),

      // Открытые чаты
      this.eventRepo.count({ where: { event: 'chat_open', ts: MoreThanOrEqual(since) } }),
    ]);

    return {
      period:       `${days} дней`,
      totalEvents,
      uniqueUsers:  parseInt(uniqueUsers?.count ?? '0', 10),
      registrations,
      ordersCreated,
      chatsOpened,
      topEvents,
      dailyActive,
    };
  }
}
