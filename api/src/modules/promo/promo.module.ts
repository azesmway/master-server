import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';
import { PromoCode, PromoUsage, Referral } from './promo.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, PromoUsage, Referral, User])],
  controllers: [PromoController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}
