import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SpecialistsModule } from '../specialists/specialists.module';

@Module({
  imports:     [SpecialistsModule],
  controllers: [AiController],
  providers:   [AiService],
  exports:     [AiService],
})
export class AiModule {}
