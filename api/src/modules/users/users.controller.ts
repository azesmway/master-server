import {
  Body, Controller, Get, Param, Patch, Query,
  Post, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Список пользователей (admin)' })
  findAll(
    @Query('page')  page:  string = '1',
    @Query('limit') limit: string = '50',
    @Query('role')  role?: string,
  ) {
    return this.usersService.findAll({
      page:  parseInt(page,  10),
      limit: parseInt(limit, 10),
      role,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Текущий пользователь' })
  getMe(@Req() req: any) {
    return req.user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Обновить профиль' })
  update(@Req() req: any, @Body() body: any) {
    return this.usersService.update(req.user.id, {
      name:  body.name,
      email: body.email,
      city:  body.city,
    });
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Загрузить аватар' })
  @UseInterceptors(FileInterceptor('avatar', {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR ?? './uploads',
      filename:    (req, file, cb) =>
        cb(null, `avatar-${uuid()}${extname(file.originalname)}`),
    }),
    limits:       { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter:   (req, file, cb) => {
      if (!file.mimetype.match(/^image\//)) {
        return cb(new Error('Только изображения'), false);
      }
      cb(null, true);
    },
  }))
  uploadAvatar(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const cdnUrl   = process.env.CDN_URL ?? 'http://localhost:3000/uploads';
    const avatarUrl = `${cdnUrl}/${file.filename}`;
    return this.usersService.updateAvatar(req.user.id, avatarUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Публичный профиль пользователя' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
