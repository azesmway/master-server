import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EscrowStatus {
  NONE      = 'none',
  PENDING   = 'pending',
  HELD      = 'held',
  RELEASING = 'releasing',
  RELEASED  = 'released',
  DISPUTED  = 'disputed',
  REFUNDED  = 'refunded',
}

export enum MessageType {
  TEXT   = 'text',
  IMAGE  = 'image',
  VIDEO  = 'video',
  FILE   = 'file',
  SYSTEM = 'system',
}

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  orderId: string;

  @Column('simple-array')
  participantIds: string[];

  @Column({
    type: 'enum', enum: EscrowStatus, default: EscrowStatus.NONE,
  })
  escrowStatus: EscrowStatus;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Message, (m) => m.room, { cascade: true })
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roomId: string;

  @ManyToOne(() => ChatRoom, (r) => r.messages)
  @JoinColumn({ name: 'roomId' })
  room: ChatRoom;

  @Column()
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ nullable: true })
  mediaUrl: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
