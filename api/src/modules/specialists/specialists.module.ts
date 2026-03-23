import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialistsService } from './specialists.service';
import { AiSearchService } from './ai-search.service';
import { SpecialistsController } from './specialists.controller';
import { Specialist, PortfolioItem } from './entities/specialist.entity';

@Module({
  imports:     [TypeOrmModule.forFeature([Specialist, PortfolioItem])],
  controllers: [SpecialistsController],
  providers:   [SpecialistsService, AiSearchService],
  exports:     [SpecialistsService, AiSearchService],
})
export class SpecialistsModule {}
