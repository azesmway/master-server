import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { User } from '../users/entities/user.entity';
import { WebPushService } from "./web-push.service";

@Module({
  imports:     [TypeOrmModule.forFeature([User])],
  controllers: [NotificationsController],
  providers:   [NotificationsService, WebPushService],
  exports:     [NotificationsService, WebPushService],
})
export class NotificationsModule {}
