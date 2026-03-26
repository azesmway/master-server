import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { IsObject, IsString } from 'class-validator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { NotificationsService } from './notifications.service'
import { WebPushService } from './web-push.service'

// ── DTO ───────────────────────────────────────────────────────────────────────

class SaveExpoTokenDto {
  @IsString()
  token: string
}

class SaveWebPushDto {
  @IsObject()
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly webPushService: WebPushService,
  ) {}

  // Expo Push Token (нативное приложение)
  @Post('token')
  @ApiOperation({ summary: 'Сохранить Expo push token' })
  saveToken(@Req() req: any, @Body() dto: SaveExpoTokenDto) {
    return this.notificationsService.savePushToken(req.user.id, dto.token)
  }

  // Web Push Subscription (PWA / браузер)
  @Post('web-push-token')
  @ApiOperation({ summary: 'Сохранить Web Push подписку (PWA)' })
  async saveWebPushToken(@Req() req: any, @Body() dto: SaveWebPushDto) {
    await this.webPushService.saveSubscription(req.user.id, dto.subscription as any)
    return { ok: true }
  }

  @Post('test')
  async testPush(@Req() req: any) {
    await this.webPushService.sendToUser(
      req.user.id,
      'Тест 🔔',
      'Web Push работает!',
      { type: 'test' }
    )
    return { ok: true }
  }
}
