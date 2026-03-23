import {
  Column, CreateDateColumn, Entity,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';

export enum PaymentStatus {
  PENDING   = 'pending',
  HELD      = 'held',      // эскроу — деньги заморожены
  RELEASED  = 'released',  // выплачено специалисту
  REFUNDED  = 'refunded',  // возврат клиенту
  FAILED    = 'failed',
}

export enum PaymentMethod {
  KASPI     = 'kaspi',
  CARD      = 'card',
  CASH      = 'cash',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'clientId' })
  client: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'KZT' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.KASPI })
  method: PaymentMethod;

  @Column({ nullable: true })
  kaspiBin: string; // номер транзакции Kaspi

  @Column({ nullable: true })
  kaspiTxnId: string;

  @Column({ nullable: true })
  expiresAt: Date; // эскроу истекает через 7 дней

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
