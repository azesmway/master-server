import {
  Body, Controller, Get, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { SpecialistsService } from '../specialists/specialists.service';

class ChatDto {
  @IsString()
  message: string;

  @IsOptional()
  history?: any[];
}

class SearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  city?: string;
}

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService:          AiService,
    private readonly specialistsService: SpecialistsService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Проверить доступность Ollama' })
  async health() {
    const available = await this.aiService.isAvailable();
    return {
      available,
      model:   'qwen2.5:1.5b',
      message: available ? 'Ollama работает' : 'Ollama недоступна',
    };
  }

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI чат-помощник' })
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    // Не грузим специалистов — это ускоряет ответ
    // Специалисты подгружаются только в /ai/search
    return this.aiService.chat(dto.message, {
      city:    req.user?.city,
      history: dto.history,
    });
  }

  @Post('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI поиск специалистов по описанию задачи' })
  async search(@Req() req: any, @Body() dto: SearchDto) {
    const { data: specialists } = await this.specialistsService.findAll({
      city:  dto.city ?? req.user?.city,
      page:  1,
      limit: 50,
    });

    return this.aiService.searchSpecialists(
      dto.query,
      specialists,
      dto.city ?? req.user?.city,
    );
  }
}
