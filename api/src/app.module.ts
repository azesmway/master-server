import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisModule, RedisModuleOptions } from '@nestjs-modules/ioredis';
import configuration from './config/configuration';

// Modules
import { AuthModule }        from './modules/auth/auth.module';
import { UsersModule }       from './modules/users/users.module';
import { SpecialistsModule } from './modules/specialists/specialists.module';
import { ChatModule }        from './modules/chat/chat.module';
import { OrdersModule }       from './modules/orders/orders.module';
import { ReviewsModule }      from './modules/reviews/reviews.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule }            from './modules/ai/ai.module';
import { AnalyticsModule }     from './modules/analytics/analytics.module';
import { VerificationModule }  from './modules/verification/verification.module';
import { EarningsModule }       from './modules/earnings/earnings.module';
import { PaymentsModule }      from './modules/payments/payments.module';

// Entities
import { User }                        from './modules/users/entities/user.entity';
import { Specialist, PortfolioItem }   from './modules/specialists/entities/specialist.entity';
import { ChatRoom, Message }           from './modules/chat/entities/chat.entity';
import { Order, OrderResponse }        from './modules/orders/entities/order.entity';
import { Review }                      from './modules/reviews/entities/review.entity';
import { AnalyticsEvent }              from './modules/analytics/entities/analytics.entity';
import { Verification }                from './modules/verification/verification.entity';
import { Earning }                     from './modules/earnings/earnings.entity';
import { Payment }                    from './modules/payments/payment.entity';

// Controllers
import { AppController } from './app.controller';
import { AppService }    from './app.service';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal:    true,
      load:        [configuration],
      envFilePath: ['.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        type:        'postgres',
        host:        config.get('database.host'),
        port:        config.get('database.port'),
        database:    config.get('database.name'),
        username:    config.get('database.user'),
        password:    config.get('database.password'),
        entities:    [User, Specialist, PortfolioItem, ChatRoom, Message, Order, OrderResponse, Review, AnalyticsEvent, Verification, Earning, Payment],
        synchronize: config.get('app.isDev'),  // только в dev!
        logging:     config.get('app.isDev'),
        ssl:         config.get('app.env') === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    // Redis (для OTP и кэша)
    RedisModule.forRootAsync({
      inject:     [ConfigService],
      useFactory: (config: ConfigService): RedisModuleOptions => ({
        type: 'single',
        url:  `redis://:${config.get('redis.password')}@${config.get('redis.host')}:${config.get('redis.port')}`,
      }),
    }),

    // Cache
    CacheModule.registerAsync({
      isGlobal: true,
      inject:   [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store:  await redisStore({
          socket: {
            host: config.get('redis.host'),
            port: config.get('redis.port'),
          },
          password: config.get('redis.password'),
        }),
        ttl: 60 * 5,  // 5 минут по умолчанию
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl:   60000,
      limit: 100,
    }]),

    // Feature modules
    AuthModule,
    UsersModule,
    SpecialistsModule,
    ChatModule,
    OrdersModule,
    ReviewsModule,
    NotificationsModule,
    AiModule,
    AnalyticsModule,
    VerificationModule,
    EarningsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}
