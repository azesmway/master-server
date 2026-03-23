import {
  Body, Controller, Get, Param, Patch, Delete,
  Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewsService } from './reviews.service';

class CreateReviewDto {
  @IsInt() @Min(1) @Max(5)
  rating: number;

  @IsString() @Length(10, 1000)
  text: string;

  @IsOptional() @IsUUID()
  orderId?: string;
}

class AddReplyDto {
  @IsString() @Length(1, 500)
  reply: string;
}

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('specialist/:specialistId')
  @ApiOperation({ summary: 'Отзывы о специалисте' })
  findBySpecialist(
    @Param('specialistId') specialistId: string,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.findBySpecialist(
      specialistId,
      parseInt(page  ?? '1',  10),
      parseInt(limit ?? '20', 10),
    );
  }

  @Post('specialist/:specialistId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Оставить отзыв' })
  create(
    @Req() req: any,
    @Param('specialistId') specialistId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(
      req.user.id,
      specialistId,
      dto.rating,
      dto.text,
      dto.orderId,
    );
  }

  @Post(':reviewId/reply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ответить на отзыв (специалист)' })
  addReply(
    @Req() req: any,
    @Param('reviewId') reviewId: string,
    @Body() dto: AddReplyDto,
  ) {
    return this.reviewsService.addReply(reviewId, req.user.id, dto.reply);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Все отзывы (admin)' })
  findAll(
    @Query('page')  page:  string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.reviewsService.findAll(parseInt(page), parseInt(limit));
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Верифицировать отзыв (admin)' })
  verify(@Param('id') id: string) {
    return this.reviewsService.verify(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить отзыв (admin)' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
