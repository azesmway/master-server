import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatRoom, Message } from './entities/chat.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly roomRepo: Repository<ChatRoom>,

    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getRooms(userId: string) {
    const rooms = await this.roomRepo
      .createQueryBuilder('r')
      .where('r.participantIds LIKE :userId', { userId: `%${userId}%` })
      .andWhere('r.isActive = true')
      .orderBy('r.updatedAt', 'DESC')
      .getMany();

    // Обогащаем данными: last message, unread count, participants
    const enriched = await Promise.all(
      rooms.map(async (room) => {
        const [lastMessage, unreadCount, participants] = await Promise.all([
          this.messageRepo.findOne({
            where:  { roomId: room.id },
            order:  { createdAt: 'DESC' },
          }),
          this.messageRepo
            .createQueryBuilder('m')
            .where('m.roomId = :roomId', { roomId: room.id })
            .andWhere('m.isRead = false')
            .andWhere('m.senderId != :userId', { userId })
            .getCount(),
          this.userRepo.findBy({ id: In(room.participantIds) }),
        ]);

        return { ...room, lastMessage, unreadCount, participants };
      }),
    );

    return { data: enriched };
  }

  async getMessages(
    roomId:  string,
    userId:  string,
    page  = 1,
    limit = 50,
  ) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room || !room.participantIds.includes(userId)) {
      throw new NotFoundException('Комната не найдена');
    }

    const [data, total] = await this.messageRepo.findAndCount({
      where:    { roomId },
      order:    { createdAt: 'ASC' },
      skip:     (page - 1) * limit,
      take:     limit,
      relations:['sender'],
    });

    return { data, meta: { page, limit, total } };
  }

  async createRoom(participantIds: string[], orderId?: string): Promise<ChatRoom> {
    // Проверяем что комната уже не существует
    const existing = await this.roomRepo
      .createQueryBuilder('r')
      .where('r.orderId = :orderId', { orderId })
      .getOne();

    if (existing) return existing;

    const room = this.roomRepo.create({
      participantIds,
      orderId,
    });

    return this.roomRepo.save(room);
  }

  async getOrCreateRoom(
    participantIds: string[],
    orderId?: string,
  ): Promise<ChatRoom> {
    if (orderId) {
      const existing = await this.roomRepo.findOne({ where: { orderId } });
      if (existing) return existing;
    }

    return this.createRoom(participantIds, orderId);
  }
}
