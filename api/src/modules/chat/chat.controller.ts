import {
  Controller, Get, Param, Query, UseGuards, Req, Post, Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'Список чат-комнат пользователя' })
  getRooms(@Req() req: any) {
    return this.chatService.getRooms(req.user.id);
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'История сообщений комнаты' })
  getMessages(
    @Req() req: any,
    @Param('roomId') roomId: string,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(
      roomId,
      req.user.id,
      parseInt(page  ?? '1',  10),
      parseInt(limit ?? '50', 10),
    );
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Создать чат-комнату' })
  createRoom(
    @Req() req: any,
    @Body() body: { participantIds: string[]; orderId?: string },
  ) {
    const ids = [...new Set([req.user.id, ...body.participantIds])];
    return this.chatService.getOrCreateRoom(ids, body.orderId);
  }
}
