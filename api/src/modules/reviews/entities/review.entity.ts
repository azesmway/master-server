import {
  Column, CreateDateColumn, Entity,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Specialist } from '../../specialists/entities/specialist.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  authorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  specialistId: string;

  @ManyToOne(() => Specialist)
  @JoinColumn({ name: 'specialistId' })
  specialist: Specialist;

  @Column({ nullable: true })
  orderId: string;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'int' })
  rating: number; // 1-5

  @Column({ type: 'text' })
  text: string;

  @Column({ nullable: true })
  reply: string; // ответ специалиста

  @Column({ default: false })
  isVerified: boolean; // проверенный отзыв (из реального заказа)

  @CreateDateColumn()
  createdAt: Date;
}
