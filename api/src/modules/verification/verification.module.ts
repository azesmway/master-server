import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { Verification } from './verification.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { SpecialistsModule } from '../specialists/specialists.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Verification, Specialist]),
    SpecialistsModule,
    NotificationsModule,
  ],
  controllers: [VerificationController],
  providers:   [VerificationService],
  exports:     [VerificationService],
})
export class VerificationModule {}
