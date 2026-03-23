import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Review } from './entities/review.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports:     [TypeOrmModule.forFeature([Review, Specialist, User])],
  controllers: [ReviewsController],
  providers:   [ReviewsService],
  exports:     [ReviewsService],
})
export class ReviewsModule {}
