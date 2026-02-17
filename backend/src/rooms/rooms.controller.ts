import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthUser } from '../auth/auth.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  RoomsService,
  type RoomInfo,
  type RoomParticipantInfo,
  type RoomPlaylistItemInfo,
  type RoomChatMessageInfo,
} from './rooms.service'
import { RoomsGateway } from './rooms.gateway'
import { AddPlaylistDto } from './dto/add-playlist.dto'
import { ReorderPlaylistDto } from './dto/reorder-playlist.dto'
import { GetRoomMessagesDto } from './dto/get-room-messages.dto'

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly roomsGateway: RoomsGateway,
    private readonly config: ConfigService,
  ) {}

  private getBaseUrl(): string {
    return this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3001')
  }

  @Post()
  async create(@CurrentUser() user: AuthUser): Promise<RoomInfo> {
    return this.rooms.createRoom(user.id, this.getBaseUrl())
  }

  @Get('by-invite/:code')
  async getByInviteCode(
    @Param('code') inviteCode: string,
    @CurrentUser() user: AuthUser,
  ): Promise<RoomInfo | { roomId: string }> {
    const room = await this.rooms.getRoomByInviteCode(
      inviteCode,
      user.id,
      this.getBaseUrl(),
    )
    if (room) return room
    const joined = await this.rooms.joinByInviteCode(inviteCode, user.id)
    if (joined) return { roomId: joined.roomId }
    throw new NotFoundException('Room not found')
  }

  @Post('join/:code')
  async joinByCode(
    @Param('code') inviteCode: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ roomId: string }> {
    const joined = await this.rooms.joinByInviteCode(inviteCode, user.id)
    if (!joined) throw new NotFoundException('Room not found')
    return joined
  }

  @Get(':id')
  async getRoom(
    @Param('id') roomId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<RoomInfo> {
    const room = await this.rooms.getRoomById(roomId, user.id)
    if (!room) throw new NotFoundException('Room not found')
    return room
  }

  @Get(':id/participants')
  async getParticipants(
    @Param('id') roomId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<RoomParticipantInfo[]> {
    return this.rooms.getParticipants(roomId, user.id)
  }

  @Get(':id/playlist')
  async getPlaylist(
    @Param('id') roomId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<RoomPlaylistItemInfo[]> {
    return this.rooms.getPlaylist(roomId, user.id)
  }

  @Post(':id/playlist')
  async addToPlaylist(
    @Param('id') roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddPlaylistDto,
  ): Promise<RoomPlaylistItemInfo[]> {
    const list = await this.rooms.addToPlaylist(roomId, user.id, dto.mediaIds)
    this.roomsGateway.broadcastPlaylistUpdated(roomId)
    return list
  }

  @Patch(':id/playlist/reorder')
  async reorderPlaylist(
    @Param('id') roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderPlaylistDto,
  ): Promise<RoomPlaylistItemInfo[]> {
    const list = await this.rooms.reorderPlaylist(roomId, user.id, dto.itemIds)
    this.roomsGateway.broadcastPlaylistUpdated(roomId)
    return list
  }

  @Delete(':id/playlist/:itemId')
  async removeFromPlaylist(
    @Param('id') roomId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.rooms.removeFromPlaylist(roomId, user.id, itemId)
    this.roomsGateway.broadcastPlaylistUpdated(roomId)
  }

  @Get(':id/media/:mediaId/view-url')
  async getMediaViewUrl(
    @Param('id') roomId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ url: string } | { url: null }> {
    const url = await this.rooms.getMediaViewUrlForRoom(roomId, user.id, mediaId)
    return url != null ? { url } : { url: null }
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') roomId: string,
    @CurrentUser() user: AuthUser,
    @Query() dto: GetRoomMessagesDto,
  ): Promise<{ messages: RoomChatMessageInfo[]; nextCursor: string | null }> {
    return this.rooms.getChatMessages(roomId, user.id, {
      cursor: dto.cursor,
      limit: dto.limit,
    })
  }
}
