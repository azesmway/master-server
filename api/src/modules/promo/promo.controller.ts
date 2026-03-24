import {
  Body, Controller, Get, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsUUID, IsNumber, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PromoService } from './promo.service';

class ValidatePromoDto {
  @IsString()
  code: string;
}

class ApplyPromoDto {
  @IsString()
  code: string;

  @IsUUID()
  orderId: string;

  @IsNumber()
  orderAmount: number;
}

class ApplyReferralDto {
  @IsString()
  referralCode: string;
}

@ApiTags('Promo')
@Controller('promo')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Проверить промокод' })
  validate(@Req() req: any, @Body() dto: ValidatePromoDto) {
    return this.promoService.validate(dto.code, req.user.id);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Применить промокод к заказу' })
  apply(@Req() req: any, @Body() dto: ApplyPromoDto) {
    return this.promoService.apply(dto.code, dto.orderId, req.user.id, dto.orderAmount);
  }

  @Get('referral')
  @ApiOperation({ summary: 'Реферальная информация текущего пользователя' })
  getReferralInfo(@Req() req: any) {
    return this.promoService.getReferralInfo(req.user.id);
  }

  @Post('referral/apply')
  @ApiOperation({ summary: 'Применить реферальный код при регистрации' })
  applyReferral(@Req() req: any, @Body() dto: ApplyReferralDto) {
    return this.promoService.applyReferral(dto.referralCode, req.user.id);
  }
}
