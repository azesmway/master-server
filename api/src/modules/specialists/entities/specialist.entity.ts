import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, OneToMany, OneToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PricingUnit {
  HOUR    = 'hour',
  DAY     = 'day',
  PROJECT = 'project',
}

@Entity('specialists')
export class Specialist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column('simple-array', { nullable: true })
  categoryIds: string[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({ default: 0 })
  completedOrders: number;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lat: number;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lng: number;

  @Column({ nullable: true })
  responseTime: string;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true, type: 'int' })
  priceFrom: number;

  @Column({ nullable: true, type: 'int' })
  priceTo: number;

  @Column({ nullable: true })
  priceCurrency: string;

  @Column({
    type: 'enum', enum: PricingUnit,
    nullable: true, default: PricingUnit.HOUR,
  })
  priceUnit: PricingUnit;

  @OneToMany(() => PortfolioItem, (p) => p.specialist, { cascade: true })
  portfolio: PortfolioItem[];

  @Column({ default: 0 })
  viewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('portfolio_items')
export class PortfolioItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  specialistId: string;

  @ManyToOne(() => Specialist, (s) => s.portfolio)
  @JoinColumn({ name: 'specialistId' })
  specialist: Specialist;

  @Column({ type: 'enum', enum: ['photo', 'video'], default: 'photo' })
  type: 'photo' | 'video';

  @Column()
  url: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ nullable: true })
  caption: string;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}