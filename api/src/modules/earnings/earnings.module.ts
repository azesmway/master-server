import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EarningsService } from './earnings.service';
import { EarningsController } from './earnings.controller';
import { Earning } from './earnings.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports:     [TypeOrmModule.forFeature([Earning, Specialist, Order])],
  controllers: [EarningsController],
  providers:   [EarningsService],
  exports:     [EarningsService],
})
export class EarningsModule {}
