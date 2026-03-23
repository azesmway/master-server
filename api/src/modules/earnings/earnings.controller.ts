import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EarningsService } from './earnings.service';

@ApiTags('Earnings')
@Controller('earnings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Статистика заработка специалиста' })
  getStats(@Req() req: any) {
    return this.earningsService.getStats(req.user.id);
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Прогноз дохода' })
  getForecast(@Req() req: any) {
    return this.earningsService.getForecast(req.user.id);
  }
}
