import {
  Body, Controller, Get, Param, Post,
  Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { PaymentMethod, PaymentStatus } from './payment.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Создать эскроу платёж
  @Post('escrow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать эскроу и получить Kaspi deeplink' })
  createEscrow(
    @Req() req: any,
    @Body() body: { orderId: string; amount: number; method?: PaymentMethod },
  ) {
    return this.paymentsService.createEscrow(
      body.orderId,
      req.user.id,
      body.amount,
      body.method ?? PaymentMethod.KASPI,
    );
  }

  // Подтвердить завершение → деньги специалисту
  @Post(':orderId/release')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Подтвердить завершение и освободить эскроу' })
  release(@Req() req: any, @Param('orderId') orderId: string) {
    return this.paymentsService.releaseEscrow(orderId, req.user.id);
  }

  // Статус платежа
  @Get(':orderId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Статус платежа по заказу' })
  status(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(orderId);
  }

  // Webhook от Kaspi (без авторизации — от внешнего сервиса)
  @Post('kaspi/webhook')
  @ApiOperation({ summary: 'Webhook от Kaspi Pay' })
  kaspiWebhook(@Body() body: any) {
    return this.paymentsService.handleKaspiWebhook(body);
  }

  // Return URL после оплаты в Kaspi
  @Get('kaspi/return')
  @ApiOperation({ summary: 'Return URL после оплаты Kaspi' })
  kaspiReturn(@Query('paymentId') paymentId: string) {
    return { success: true, paymentId, message: 'Оплата обрабатывается' };
  }

  // Возврат (admin)
  @Post(':orderId/refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Возврат средств клиенту (admin)' })
  refund(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() body: { reason: string },
  ) {
    return this.paymentsService.refundEscrow(orderId, req.user.id, body.reason);
  }

  // Список платежей (admin)
  @Get('admin/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Все платежи (admin)' })
  findAll(@Query('status') status?: PaymentStatus) {
    return this.paymentsService.findAll(status);
  }
}
