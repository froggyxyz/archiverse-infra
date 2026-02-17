import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { ArchiveService } from '../archive/archive.service'
import { S3Service } from '../s3/s3.service'

const INVITE_CODE_LENGTH = 10
const ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export type RoomInfo = {
  id: string
  inviteCode: string
  inviteLink: string
  createdById: string
  createdAt: Date
}

export type RoomParticipantInfo = {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  joinedAt: Date
}

export type RoomPlaylistItemInfo = {
  id: string
  mediaId: string
  order: number
  addedById: string
  addedByUsername: string
  filename: string
  mimeType: string
  type: string
  /** URL для просмотра (участник комнаты). Истекает ~1 ч. */
  viewUrl: string | null
  thumbnailUrl: string | null
  createdAt: Date
}

export type RoomChatMessageInfo = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: Date
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly archive: ArchiveService,
    private readonly s3: S3Service,
  ) {}

  private generateInviteCode(): string {
    const bytes = randomBytes(INVITE_CODE_LENGTH)
    return Array.from(bytes, (b) => ALPHANUM[b % ALPHANUM.length]).join('')
  }

  private async ensureUniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = this.generateInviteCode()
      const exists = await this.prisma.room.findUnique({
        where: { inviteCode: code },
        select: { id: true },
      })
      if (!exists) return code
    }
    throw new ConflictException('Failed to generate unique invite code')
  }

  async createRoom(userId: string, baseUrl: string): Promise<RoomInfo> {
    const inviteCode = await this.ensureUniqueInviteCode()
    const room = await this.prisma.room.create({
      data: {
        createdById: userId,
        inviteCode,
        participants: { create: { userId } },
      },
    })
    const inviteLink = `${baseUrl.replace(/\/$/, '')}/rooms/join/${inviteCode}`
    return {
      id: room.id,
      inviteCode: room.inviteCode,
      inviteLink,
      createdById: room.createdById,
      createdAt: room.createdAt,
    }
  }

  async getRoomById(roomId: string, userId: string): Promise<RoomInfo | null> {
    const participant = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { room: true },
    })
    if (!participant) return null
    const baseUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001'
    const inviteLink = `${baseUrl.replace(/\/$/, '')}/rooms/join/${participant.room.inviteCode}`
    return {
      id: participant.room.id,
      inviteCode: participant.room.inviteCode,
      inviteLink,
      createdById: participant.room.createdById,
      createdAt: participant.room.createdAt,
    }
  }

  async getRoomByInviteCode(
    inviteCode: string,
    userId: string,
    baseUrl: string,
  ): Promise<RoomInfo | null> {
    const room = await this.prisma.room.findUnique({
      where: { inviteCode },
      select: { id: true, inviteCode: true, createdById: true, createdAt: true },
    })
    if (!room) return null
    const participant = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
    })
    if (!participant) return null
    const inviteLink = `${baseUrl.replace(/\/$/, '')}/rooms/join/${room.inviteCode}`
    return {
      id: room.id,
      inviteCode: room.inviteCode,
      inviteLink,
      createdById: room.createdById,
      createdAt: room.createdAt,
    }
  }

  /** Войти по inviteCode: если ещё не участник — добавляем. Возвращает roomId или null. */
  async joinByInviteCode(
    inviteCode: string,
    userId: string,
  ): Promise<{ roomId: string } | null> {
    const room = await this.prisma.room.findUnique({
      where: { inviteCode },
      select: { id: true },
    })
    if (!room) return null
    await this.prisma.roomParticipant.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      create: { roomId: room.id, userId },
      update: {},
    })
    return { roomId: room.id }
  }

  async ensureParticipant(roomId: string, userId: string): Promise<void> {
    const p = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    })
    if (!p) throw new ForbiddenException('Not a room participant')
  }

  async getParticipants(roomId: string, userId: string): Promise<RoomParticipantInfo[]> {
    await this.ensureParticipant(roomId, userId)
    const participants = await this.prisma.roomParticipant.findMany({
      where: { roomId },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    return participants.map((p) => ({
      id: p.id,
      userId: p.user.id,
      username: p.user.username,
      avatarUrl: p.user.avatarUrl,
      joinedAt: p.joinedAt,
    }))
  }

  async getPlaylist(roomId: string, userId: string): Promise<RoomPlaylistItemInfo[]> {
    await this.ensureParticipant(roomId, userId)
    const items = await this.prisma.roomPlaylistItem.findMany({
      where: { roomId },
      include: {
        media: true,
        addedBy: { select: { username: true } },
      },
      orderBy: { order: 'asc' },
    })
    const result: RoomPlaylistItemInfo[] = []
    for (const item of items) {
      const viewUrl =
        item.media.userId === userId
          ? await this.archive.getMediaViewUrl(userId, item.mediaId)
          : await this.getMediaViewUrlForRoom(roomId, userId, item.mediaId)
      const thumbnailUrl =
        item.media.thumbnailKey != null
          ? await this.s3.getPresignedUrl(item.media.thumbnailKey)
          : null
      result.push({
        id: item.id,
        mediaId: item.mediaId,
        order: item.order,
        addedById: item.addedById,
        addedByUsername: item.addedBy.username,
        filename: item.media.filename,
        mimeType: item.media.mimeType,
        type: item.media.type,
        viewUrl,
        thumbnailUrl,
        createdAt: item.createdAt,
      })
    }
    return result
  }

  /** URL для просмотра медиа из плейлиста комнаты (участник может смотреть медиа других). */
  async getMediaViewUrlForRoom(
    roomId: string,
    userId: string,
    mediaId: string,
  ): Promise<string | null> {
    await this.ensureParticipant(roomId, userId)
    const inPlaylist = await this.prisma.roomPlaylistItem.findFirst({
      where: { roomId, mediaId },
      include: { media: { select: { userId: true } } },
    })
    if (!inPlaylist) throw new ForbiddenException('Media not in room playlist')
    return this.archive.getMediaViewUrl(inPlaylist.media.userId, mediaId)
  }

  async addToPlaylist(
    roomId: string,
    userId: string,
    mediaIds: string[],
  ): Promise<RoomPlaylistItemInfo[]> {
    await this.ensureParticipant(roomId, userId)
    const maxOrder = await this.prisma.roomPlaylistItem
      .aggregate({ where: { roomId }, _max: { order: true } })
      .then((r) => r._max.order ?? -1)
    const participants = await this.prisma.roomParticipant.findMany({
      where: { roomId },
      select: { userId: true },
    })
    const participantUserIds = new Set(participants.map((p) => p.userId))
    const mediaList = await this.prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        userId: { in: [...participantUserIds] },
        status: 'COMPLETED',
      },
      select: { id: true },
    })
    const existingMediaIds = await this.prisma.roomPlaylistItem
      .findMany({
        where: { roomId, mediaId: { in: mediaList.map((m) => m.id) } },
        select: { mediaId: true },
      })
      .then((rows) => new Set(rows.map((r) => r.mediaId)))
    const toAdd = mediaList.filter((m) => !existingMediaIds.has(m.id))
    if (toAdd.length === 0) {
      throw new BadRequestException(
        'No valid media to add (must be yours or another participant\'s, COMPLETED, not already in playlist)',
      )
    }
    await this.prisma.roomPlaylistItem.createMany({
      data: toAdd.map((m, i) => ({
        roomId,
        mediaId: m.id,
        order: maxOrder + 1 + i,
        addedById: userId,
      })),
    })
    return this.getPlaylist(roomId, userId)
  }

  async reorderPlaylist(
    roomId: string,
    userId: string,
    itemIds: string[],
  ): Promise<RoomPlaylistItemInfo[]> {
    await this.ensureParticipant(roomId, userId)
    const [items, total] = await Promise.all([
      this.prisma.roomPlaylistItem.findMany({
        where: { roomId, id: { in: itemIds } },
        select: { id: true },
      }),
      this.prisma.roomPlaylistItem.count({ where: { roomId } }),
    ])
    if (items.length !== itemIds.length || items.length !== total) {
      throw new BadRequestException(
        'itemIds must contain all playlist item ids in the new order',
      )
    }
    const idToOrder = new Map(itemIds.map((id, i) => [id, i]))
    await this.prisma.$transaction(
      Array.from(idToOrder.entries(), ([id, order]) =>
        this.prisma.roomPlaylistItem.update({
          where: { id },
          data: { order },
        }),
      ),
    )
    return this.getPlaylist(roomId, userId)
  }

  async removeFromPlaylist(
    roomId: string,
    userId: string,
    itemId: string,
  ): Promise<void> {
    await this.ensureParticipant(roomId, userId)
    const item = await this.prisma.roomPlaylistItem.findFirst({
      where: { id: itemId, roomId },
    })
    if (!item) throw new NotFoundException('Playlist item not found')
    await this.prisma.roomPlaylistItem.delete({ where: { id: itemId } })
  }

  async getChatMessages(
    roomId: string,
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ messages: RoomChatMessageInfo[]; nextCursor: string | null }> {
    await this.ensureParticipant(roomId, userId)
    const limit = Math.min(opts.limit ?? 50, 100)
    const cursor = opts.cursor ? { id: opts.cursor } : undefined
    const rows = await this.prisma.roomChatMessage.findMany({
      where: { roomId },
      cursor,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { username: true } } },
    })
    const hasMore = rows.length > limit
    const slice = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? slice[slice.length - 1].id : null
    const messages: RoomChatMessageInfo[] = slice.reverse().map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.username,
      text: m.text,
      createdAt: m.createdAt,
    }))
    return { messages, nextCursor }
  }

  async sendChatMessage(
    roomId: string,
    userId: string,
    text: string,
  ): Promise<RoomChatMessageInfo> {
    await this.ensureParticipant(roomId, userId)
    const trimmed = text.trim()
    if (!trimmed) throw new BadRequestException('Message text required')
    const msg = await this.prisma.roomChatMessage.create({
      data: { roomId, senderId: userId, text: trimmed },
      include: { sender: { select: { username: true } } },
    })
    return {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.sender.username,
      text: msg.text,
      createdAt: msg.createdAt,
    }
  }
}
