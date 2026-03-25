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

export enum OrderType {
  STANDARD = 'standard',
  BARTER   = 'barter',
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

  @Column({ nullable: true, type: 'decimal', precision: 9, scale: 6 })
  lat: number;

  @Column({ nullable: true, type: 'decimal', precision: 9, scale: 6 })
  lng: number;

  @Column('simple-array', { nullable: true })
  photos: string[];

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PUBLISHED })
  status: OrderStatus;

  @Column({ type: 'enum', enum: OrderType, default: OrderType.STANDARD })
  type: OrderType;

  @Column({ nullable: true })
  deadline: Date;

  @Column({ default: 0 })
  responseCount: number;

  // ── Partner fields ────────────────────────────────────────

  @Column({ nullable: true })
  partnerId: string;

  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 2 })
  partnerCommissionPercent: number;

  @Column({ nullable: true, type: 'int' })
  partnerCommissionAmount: number;

  @Column({ nullable: true, type: 'int' })
  platformCutAmount: number;

  @Column({ default: false })
  partnerPaid: boolean;

  @Column({ nullable: true })
  partnerClientName: string;

  @Column({ nullable: true })
  partnerClientPhone: string;

  // ── Barter fields ─────────────────────────────────────────

  @Column({ nullable: true, type: 'text' })
  barterClientOffer: string;

  @Column({ nullable: true, type: 'text' })
  barterSpecialistWant: string;

  @Column({ nullable: true, type: 'int' })
  barterPlatformFee: number;

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
