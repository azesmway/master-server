import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  role: string;

  @Column({ type: 'jsonb', default: {} })
  props: Record<string, any>;

  @Column({ type: 'timestamp' })
  ts: Date;
}
