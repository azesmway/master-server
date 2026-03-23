import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Specialist } from '../../specialists/entities/specialist.entity';

export enum OrderStatus {
  DRAFT          = 'draft',
  PUBLISHED      = 'published',
  IN_PROGRESS    = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  COMPLETED      = 'completed',
  DISPUTED       = 'disputed',
  CANCELLED      = 'cancelled',
}

export enum ResponseStatus {
  PENDING  = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

// ─── Order ────────────────────────────────────────────────────────────────────

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'clientId' })
  client: User;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  categoryId: string;

  @Column({ nullable: true, type: 'int' })
  budgetFrom: number;

  @Column({ nullable: true, type: 'int' })
  budgetTo: number;

  @Column({ nullable: true })
  budgetCurrency: string;

  @Column({ nullable: true })
  budgetUnit: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  address: string;

  @Column('simple-array', { nullable: true })
  photos: string[];

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PUBLISHED })
  status: OrderStatus;

  @Column({ nullable: true })
  deadline: Date;

  @Column({ default: 0 })
  responseCount: number;

  @OneToMany(() => OrderResponse, (r) => r.order, { cascade: true })
  responses: OrderResponse[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── Response ─────────────────────────────────────────────────────────────────

@Entity('order_responses')
export class OrderResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, (o) => o.responses)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  specialistId: string;

  @ManyToOne(() => Specialist)
  @JoinColumn({ name: 'specialistId' })
  specialist: Specialist;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'int' })
  price: number;

  @Column({ default: 'KZT' })
  currency: string;

  @Column({ type: 'enum', enum: ResponseStatus, default: ResponseStatus.PENDING })
  status: ResponseStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
