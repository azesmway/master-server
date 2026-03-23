import {
  Body, Controller, Get, Param, Post, Query,
  Req, Patch, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpecialistsService } from './specialists.service';
import { AiSearchService } from './ai-search.service';

@ApiTags('Specialists')
@Controller('specialists')
export class SpecialistsController {
  constructor(
    private readonly specialistsService: SpecialistsService,
    private readonly aiSearchService:    AiSearchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список специалистов с фильтрами' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'city',       required: false })
  @ApiQuery({ name: 'query',      required: false })
  @ApiQuery({ name: 'sortBy',     required: false, enum: ['rating','reviews','price','online'] })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
  findAll(@Query() query: any) {
    return this.specialistsService.findAll({
      categoryId: query.categoryId,
      city:       query.city,
      query:      query.query,
      sortBy:     query.sortBy,
      page:       parseInt(query.page  ?? '1',  10),
      limit:      parseInt(query.limit ?? '20', 10),
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Профиль текущего специалиста' })
  getMyProfile(@Req() req: any) {
    return this.specialistsService.findByUserId(req.user.id);
  }

  @Post('ai-search')
  @ApiOperation({ summary: 'AI поиск специалистов по описанию задачи' })
  async aiSearch(@Body('query') query: string): Promise<any> {
    const specialists = await this.specialistsService.findAll({ page: 1, limit: 30 });
    return this.aiSearchService.search(query, specialists.data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Профиль специалиста по ID' })
  findOne(@Param('id') id: string) {
    return this.specialistsService.findOne(id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить профиль специалиста' })
  async updateMyProfile(@Req() req: any, @Body() body: any) {
    const specialist = await this.specialistsService.findByUserId(req.user.id);
    if (!specialist) {
      return this.specialistsService.create(req.user.id);
    }
    return this.specialistsService.update(specialist.id, body);
  }

  @Post('me/portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Добавить элемент в портфолио' })
  async addPortfolio(
    @Req() req: any,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const specialist = await this.specialistsService.findByUserId(req.user.id);
    if (!specialist) throw new Error('Профиль специалиста не найден');

    return this.specialistsService.addPortfolioItem(specialist.id, {
      type:    body.type ?? 'photo',
      url:     body.url ?? file?.path,
      caption: body.caption,
    });
  }
}