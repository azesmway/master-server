import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateResponseDto } from './dto';
import { OrderStatus } from './entities/order.entity';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Orders ────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Список заказов' })
  @ApiQuery({ name: 'clientId',   required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'city',       required: false })
  @ApiQuery({ name: 'status',     required: false })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
  findAll(@Req() req: any, @Query() query: any) {
    return this.ordersService.findAll(
      {
        clientId:   query.clientId,
        categoryId: query.categoryId,
        city:       query.city,
        status:     query.status,
        page:       parseInt(query.page  ?? '1',  10),
        limit:      parseInt(query.limit ?? '20', 10),
      },
      req.user.role,
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'Мои заказы (клиент)' })
  getMyOrders(@Req() req: any, @Query() query: any) {
    return this.ordersService.findAll(
      {
        clientId: req.user.id,
        status:   query.status,
        page:     parseInt(query.page  ?? '1',  10),
        limit:    parseInt(query.limit ?? '20', 10),
      },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали заказа' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать заказ' })
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Изменить статус заказа' })
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, req.user.id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Отменить заказ' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.delete(id, req.user.id);
  }

  // ── Responses ─────────────────────────────────────────────

  @Post(':id/responses')
  @ApiOperation({ summary: 'Откликнуться на заказ (специалист)' })
  createResponse(
    @Req() req: any,
    @Param('id') orderId: string,
    @Body() dto: CreateResponseDto,
  ) {
    return this.ordersService.createResponse(orderId, req.user.id, dto);
  }

  @Post('responses/:responseId/accept')
  @ApiOperation({ summary: 'Принять отклик (клиент) → создаёт чат' })
  acceptResponse(
    @Req() req: any,
    @Param('responseId') responseId: string,
  ) {
    return this.ordersService.acceptResponse(responseId, req.user.id);
  }

  @Get('responses/my')
  @ApiOperation({ summary: 'Мои отклики (специалист)' })
  getMyResponses(@Req() req: any) {
    return this.ordersService.getMyResponses(req.user.id);
  }
}
