// api/src/modules/notifications/web-push.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as webpush from 'web-push'
import { ConfigService } from '@nestjs/config'
import { User } from '../users/entities/user.entity'

// Колонка в User entity: webPushSubscription: string (JSON)

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name)
  private readonly enabled: boolean

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config:   ConfigService,
  ) {
    const publicKey  = config.get<string>('VAPID_PUBLIC_KEY')
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY')
    const email      = config.get<string>('VAPID_EMAIL') ?? 'admin@master.kz'

    if (publicKey && privateKey) {
      webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey)
      this.enabled = true
      this.logger.log('Web Push (VAPID) инициализирован')
    } else {
      this.enabled = false
      this.logger.warn('VAPID ключи не заданы — Web Push отключён')
    }
  }

  // ── Сохранение Web Push подписки ─────────────────────────────────────────

  async saveSubscription(userId: string, subscription: webpush.PushSubscription): Promise<void> {
    await this.userRepo.update(userId, {
      webPushSubscription: JSON.stringify(subscription),
    } as any)
    this.logger.log(`Web Push подписка сохранена для ${userId}`)
  }

  // ── Отправка уведомления ─────────────────────────────────────────────────

  async sendToUser(
    userId:  string,
    title:   string,
    body:    string,
    data?:   Record<string, any>,
  ): Promise<void> {
    if (!this.enabled) return

    const user = await this.userRepo.findOne({ where: { id: userId } })
    const subJson = (user as any)?.webPushSubscription
    if (!subJson) return

    let subscription: webpush.PushSubscription
    try {
      subscription = JSON.parse(subJson)
    } catch {
      return
    }

    const payload = JSON.stringify({
      title,
      body,
      data: data ?? {},
      tag:  data?.type ?? 'default',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      requireInteraction: false,
    })

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 86400, // 24 часа
        urgency: 'normal',
      })
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Подписка устарела — удаляем
        await this.userRepo.update(userId, { webPushSubscription: null } as any)
        this.logger.warn(`Web Push подписка устарела, удалена для ${userId}`)
      } else {
        this.logger.error(`Web Push ошибка для ${userId}:`, err.message)
      }
    }
  }

  // ── Convenience методы (зеркало NotificationsService) ────────────────────

  async sendNewMessage(toUserId: string, senderName: string, content: string, roomId: string) {
    await this.sendToUser(
      toUserId,
      `💬 ${senderName}`,
      content.length > 80 ? content.slice(0, 80) + '...' : content,
      { type: 'new_message', roomId },
    )
  }

  async sendNewResponse(clientId: string, specialistName: string, orderTitle: string, orderId: string) {
    await this.sendToUser(
      clientId,
      '📨 Новый отклик',
      `${specialistName} откликнулся на "${orderTitle}"`,
      { type: 'new_response', orderId },
    )
  }

  async sendResponseAccepted(specialistUserId: string, orderTitle: string, roomId: string) {
    await this.sendToUser(
      specialistUserId,
      '✅ Отклик принят!',
      `Клиент принял ваш отклик на "${orderTitle}"`,
      { type: 'response_accepted', roomId },
    )
  }

  async sendNearbyOrder(specialistUserId: string, orderTitle: string, orderId: string, distanceKm: number) {
    await this.sendToUser(
      specialistUserId,
      '📍 Заказ рядом с вами',
      `${orderTitle} · ${distanceKm.toFixed(1)} км`,
      { type: 'nearby_order', orderId },
    )
  }
}
