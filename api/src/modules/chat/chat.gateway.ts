import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody,
  ConnectedSocket, OnGatewayConnection,
  OnGatewayDisconnect, OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom, Message, MessageType } from './entities/chat.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // userId → socketId маппинг для онлайн-статуса
  private onlineUsers = new Map<string, string>();

  constructor(
    private readonly jwtService:    JwtService,
    private readonly configService: ConfigService,

    @InjectRepository(ChatRoom)
    private readonly roomRepo: Repository<ChatRoom>,

    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly notificationsService: NotificationsService,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket Gateway запущен');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        ?? client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
      });

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) { client.disconnect(); return; }

      // Сохраняем userId в socket data
      client.data.userId = user.id;
      client.data.user   = user;

      // Помечаем как онлайн
      this.onlineUsers.set(user.id, client.id);

      // Подписываем на все комнаты пользователя при коннекте
      this.logger.log(`[connect] Ищем комнаты для userId: ${user.id}`);
      const rooms = await this.roomRepo
        .createQueryBuilder('r')
        .where('r.participantIds LIKE :userId', { userId: `%${user.id}%` })
        .getMany();

      this.logger.log(`[connect] Найдено комнат: ${rooms.length}`);
      for (const r of rooms) {
        client.join(`room:${r.id}`);
        this.logger.log(`[connect] ${user.name} (${user.id}) вступил в room:${r.id}`);
      }

      this.logger.log(`Подключился: ${user.id} (${user.name})`);

      // Оповещаем собеседников об онлайн статусе
      this.broadcastOnlineStatus(user.id, true);

    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.onlineUsers.delete(userId);
      this.broadcastOnlineStatus(userId, false);
      this.logger.log(`Отключился: ${userId}`);
    }
  }

  // ── Events ─────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId:   string;
      content:  string;
      type?:    MessageType;
      mediaUrl?: string;
    },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;

    // Проверяем что пользователь в комнате
    const room = await this.roomRepo.findOne({ where: { id: data.roomId } });
    if (!room) return;
    const ids = room.participantIds as unknown as string;
    if (!ids.includes(userId)) return;

    // Сохраняем сообщение
    const message = this.messageRepo.create({
      roomId:   data.roomId,
      senderId: userId,
      content:  data.content,
      type:     data.type ?? MessageType.TEXT,
      mediaUrl: data.mediaUrl,
    });

    await this.messageRepo.save(message);

    // Загружаем с sender для ответа
    const saved = await this.messageRepo.findOne({
      where:     { id: message.id },
      relations: ['sender'],
    });

    // Push уведомления участникам которые не онлайн
    try {
      const room = await this.roomRepo.findOne({ where: { id: data.roomId } });
      if (room) {
        const ids = (room.participantIds as unknown as string).split(',');
        const offlineIds = ids.filter((id) => id !== userId && !this.onlineUsers.has(id));
        for (const offlineId of offlineIds) {
          await this.notificationsService.sendNewMessage(
            offlineId,
            client.data.user?.name ?? 'Собеседник',
            saved?.content ?? '',
            data.roomId,
          );
        }
      }
    } catch (e) {
      this.logger.warn('Push error:', e);
    }

    // Рассылаем всем в комнате
    const roomKey = `room:${data.roomId}`;
    const sockets = await this.server.in(roomKey).fetchSockets();
    this.logger.log(`[send] Рассылаем в ${roomKey}, слушателей: ${sockets.length}`);
    this.server.to(roomKey).emit('new_message', saved);

    return saved;
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;

    await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true, readAt: new Date() })
      .where('roomId = :roomId', { roomId: data.roomId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    // Оповещаем отправителя о прочтении
    this.server.to(`room:${data.roomId}`).emit('messages_read', {
      roomId: data.roomId,
      readBy: userId,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;

    client.to(`room:${data.roomId}`).emit('user_typing', {
      userId,
      roomId:   data.roomId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data.roomId) return;

    const room = await this.roomRepo.findOne({ where: { id: data.roomId } });
    if (!room) return { error: 'Room not found' };

    // Проверяем LIKE для simple-array
    const ids = room.participantIds as unknown as string;
    if (!ids.includes(userId)) return { error: 'Not a participant' };

    client.join(`room:${data.roomId}`);
    console.log(`[Gateway] ${userId} вручную вступил в room:${data.roomId}`);
    return { joined: true, roomId: data.roomId };
  }

  // ── Helpers ────────────────────────────────────────────────

  private broadcastOnlineStatus(userId: string, isOnline: boolean) {
    this.server.emit('user_status', { userId, isOnline });
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}