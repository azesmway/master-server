import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo   = new Expo();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── Сохранение push токена ────────────────────────────────

  async savePushToken(userId: string, token: string): Promise<void> {
    // Сохраняем в поле user — добавим колонку pushToken
    await this.userRepo.update(userId, { pushToken: token } as any);
    this.logger.log(`Push token сохранён для ${userId}`);
  }

  // ── Отправка уведомлений ─────────────────────────────────

  async sendToUser(
    userId: string,
    title:  string,
    body:   string,
    data?:  Record<string, any>,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const token = (user as any)?.pushToken;

    if (!token || !Expo.isExpoPushToken(token)) {
      this.logger.warn(`Нет push токена для ${userId}`);
      return;
    }

    await this.sendPush([{ to: token, title, body, data, sound: 'default' }]);
  }

  async sendNewMessage(
    toUserId:   string,
    senderName: string,
    content:    string,
    roomId:     string,
  ): Promise<void> {
    await this.sendToUser(
      toUserId,
      `💬 ${senderName}`,
      content.length > 80 ? content.slice(0, 80) + '...' : content,
      { type: 'new_message', roomId },
    );
  }

  async sendNewResponse(
    clientId:        string,
    specialistName:  string,
    orderTitle:      string,
    orderId:         string,
  ): Promise<void> {
    await this.sendToUser(
      clientId,
      '📨 Новый отклик',
      `${specialistName} откликнулся на заказ "${orderTitle}"`,
      { type: 'new_response', orderId },
    );
  }

  async sendResponseAccepted(
    specialistUserId: string,
    orderTitle:       string,
    roomId:           string,
  ): Promise<void> {
    await this.sendToUser(
      specialistUserId,
      '✅ Отклик принят!',
      `Клиент принял ваш отклик на заказ "${orderTitle}"`,
      { type: 'response_accepted', roomId },
    );
  }

  // ── Низкоуровневая отправка ───────────────────────────────

  private async sendPush(messages: ExpoPushMessage[]): Promise<void> {
    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket.status === 'error') {
            this.logger.error(`Push ошибка: ${ticket.message}`);
          }
        });
      } catch (e) {
        this.logger.error('Push send error:', e);
      }
    }
  }
}
