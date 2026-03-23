import {
  Column, CreateDateColumn, Entity,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Specialist } from '../specialists/entities/specialist.entity';
import { Order } from '../orders/entities/order.entity';

export enum EarningType {
  ORDER     = 'order',     // оплата за заказ
  BONUS     = 'bonus',     // бонус от платформы
  REFUND    = 'refund',    // возврат
}

export enum EarningStatus {
  PENDING   = 'pending',   // ожидает
  AVAILABLE = 'available', // доступно для вывода
  WITHDRAWN = 'withdrawn', // выведено
}

@Entity('earnings')
export class Earning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // сумма до комиссии

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  commission: number; // комиссия платформы (8%)

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  net: number; // чистая сумма

  @Column({ default: 'KZT' })
  currency: string;

  @Column({ type: 'enum', enum: EarningType, default: EarningType.ORDER })
  type: EarningType;

  @Column({ type: 'enum', enum: EarningStatus, default: EarningStatus.PENDING })
  status: EarningStatus;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
