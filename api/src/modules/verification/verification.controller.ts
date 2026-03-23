import {
  Body, Controller, Get, Param, Post,
  Req, UploadedFiles, UseGuards, UseInterceptors, Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerificationService } from './verification.service';
import { VerificationStatus } from './verification.entity';
import { SpecialistsService } from '../specialists/specialists.service';

@ApiTags('Verification')
@Controller('verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly specialistsService:  SpecialistsService,
  ) {}

  // Специалист подаёт заявку
  @Post('apply')
  @ApiOperation({ summary: 'Подать заявку на верификацию' })
  @UseInterceptors(FilesInterceptor('documents', 5, {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR ?? './uploads',
      filename:    (req, file, cb) =>
        cb(null, `doc-${uuid()}${extname(file.originalname)}`),
    }),
    limits:     { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|pdf/;
      if (!allowed.test(extname(file.originalname).toLowerCase())) {
        return cb(new Error('Только JPG, PNG, PDF'), false);
      }
      cb(null, true);
    },
  }))
  async apply(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const specialist = await this.specialistsService.findByUserId(req.user.id);
    if (!specialist) throw new Error('Создайте профиль специалиста');

    const cdnUrl = process.env.CDN_URL ?? 'https://api.it-trend.dev/uploads';
    const urls   = files.map(f => `${cdnUrl}/${f.filename}`);

    return this.verificationService.apply(specialist.id, urls);
  }

  // Статус верификации
  @Get('status')
  @ApiOperation({ summary: 'Статус моей верификации' })
  async getMyStatus(@Req() req: any) {
    const specialist = await this.specialistsService.findByUserId(req.user.id);
    if (!specialist) return { isVerified: false, verification: null };
    return this.verificationService.getStatus(specialist.id);
  }

  // Список заявок (для админа)
  @Get('admin/list')
  @ApiOperation({ summary: 'Список заявок на верификацию (admin)' })
  findAll(@Query('status') status?: VerificationStatus) {
    return this.verificationService.findAll(status);
  }

  // Одобрить/отклонить (для админа)
  @Post('admin/:id/review')
  @ApiOperation({ summary: 'Рассмотреть заявку (admin)' })
  review(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { approved: boolean; comment?: string },
  ) {
    return this.verificationService.review(id, req.user.id, body.approved, body.comment);
  }
}
