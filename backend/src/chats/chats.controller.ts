import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Body,
  ForbiddenException,
} from '@nestjs/common'
import type { AuthUser } from '../auth/auth.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ChatsService, type ChatListItem, type MessageWithAttachments, type UploadUrlResult } from './chats.service'
import { GetChatMessagesDto } from './dto/get-chat-messages.dto'
import { UploadChatFileDto } from './dto/upload-chat-file.dto'
import { CreateDirectChatDto } from './dto/create-direct-chat.dto'

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<ChatListItem[]> {
    return this.chats.getChats(user.id)
  }

  @Get(':id')
  async getChat(
    @Param('id') chatId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: GetChatMessagesDto,
  ): Promise<{ messages: MessageWithAttachments[]; nextCursor: string | null }> {
    const chat = await this.chats.getChatByIdAndUser(chatId, user.id)
    if (!chat) throw new ForbiddenException('Not a participant')
    return this.chats.getChatMessages(chatId, user.id, {
      cursor: query.cursor,
      limit: query.limit,
    })
  }

  @Post(':id/read')
  async markRead(
    @Param('id') chatId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: boolean }> {
    await this.chats.markChatRead(chatId, user.id)
    return { ok: true }
  }

  @Post('direct')
  async getOrCreateDirect(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDirectChatDto,
  ): Promise<{ chatId: string }> {
    const chatId = await this.chats.getOrCreateDirectChat(user.id, dto.userId)
    return { chatId }
  }

  @Post(':id/upload-url')
  async getUploadUrl(
    @Param('id') chatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadChatFileDto,
  ): Promise<UploadUrlResult> {
    return this.chats.getUploadUrl(chatId, user.id, dto)
  }
}
