import {
  Column, CreateDateColumn, Entity,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

export enum PromoType {
  PERCENT       = 'percent',
  FIXED         = 'fixed',
  FREE_RESPONSE = 'free_response',
}

// ─── Promo Code ───────────────────────────────────────────────────────────────

@Entity('promo_codes')
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'enum', enum: PromoType })
  type: PromoType;

  @Column({ type: 'int' })
  value: number; // % или ₸

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'int' })
  minOrderAmount: number;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ nullable: true, type: 'int' })
  maxUsage: number; // null = безлимит

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

// ─── Promo Usage ──────────────────────────────────────────────────────────────

@Entity('promo_usages')
export class PromoUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  promoCodeId: string;

  @ManyToOne(() => PromoCode)
  @JoinColumn({ name: 'promoCodeId' })
  promoCode: PromoCode;

  @Column({ nullable: true })
  orderId: string;

  @Column({ type: 'int' })
  discountAmount: number; // фактическая скидка в ₸

  @CreateDateColumn()
  createdAt: Date;
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export enum ReferralStatus {
  REGISTERED  = 'registered',
  FIRST_ORDER = 'first_order',
  PAID        = 'paid',
}

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  referrerId: string; // кто пригласил

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerId' })
  referrer: User;

  @Column()
  refereeId: string; // кого пригласили

  @ManyToOne(() => User)
  @JoinColumn({ name: 'refereeId' })
  referee: User;

  @Column({ type: 'enum', enum: ReferralStatus, default: ReferralStatus.REGISTERED })
  status: ReferralStatus;

  @Column({ type: 'int', default: 0 })
  bonus: number; // ₸ начислено

  @Column({ default: false })
  bonusPaid: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
