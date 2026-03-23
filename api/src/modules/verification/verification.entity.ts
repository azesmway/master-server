import {
  Column, CreateDateColumn, Entity,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Specialist } from '../specialists/entities/specialist.entity';

export enum VerificationStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('verifications')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  specialistId: string;

  @ManyToOne(() => Specialist)
  @JoinColumn({ name: 'specialistId' })
  specialist: Specialist;

  @Column({ type: 'simple-array' })
  documents: string[]; // URLs загруженных документов

  @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
  status: VerificationStatus;

  @Column({ nullable: true })
  comment: string; // комментарий от админа

  @Column({ nullable: true })
  reviewedBy: string; // userId админа

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
