import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { S3Service } from '../s3/s3.service'
import type { UploadChatFileDto } from './dto/upload-chat-file.dto'
import type { ChatAttachmentKeyDto } from './dto/create-message-socket.dto'
import { ChatAttachmentType } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const CHAT_KEY_PREFIX = 'chat/'
const PRESIGNED_EXPIRES = 3600
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2 GB

const ALLOWED_MIME_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_MIME_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED_MIME_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav']

export type ChatListItem = {
  id: string
  otherUser: { id: string; username: string; avatarUrl: string | null }
  lastMessageAt: Date
  lastMessage: {
    text: string | null
    attachmentPreview: { type: string; url: string } | null
  } | null
  unreadCount: number
}

export type MessageWithAttachments = {
  id: string
  chatId: string
  senderId: string
  text: string | null
  createdAt: Date
  attachments: Array<{
    id: string
    type: string
    s3Key: string
    thumbnailKey: string | null
    mimeType: string
    size: bigint
    url: string
    thumbnailUrl: string | null
  }>
}

export type UploadUrlResult = { uploadUrl: string; key: string }

export type CreatedMessagePayload = {
  message: MessageWithAttachments
  recipientUserIds: string[]
}

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getChats(userId: string): Promise<ChatListItem[]> {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        chat: {
          include: {
            participants: { include: { user: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { attachments: true },
            },
          },
        },
      },
      orderBy: { chat: { updatedAt: 'desc' } },
    })

    const items: ChatListItem[] = []
    for (const p of participants) {
      const chat = p.chat
      const otherParticipant = chat.participants.find((x) => x.userId !== userId)
      if (!otherParticipant) continue
      const otherUser = otherParticipant.user
      const lastMsg = chat.messages[0] ?? null
      const unreadCount = await this.getUnreadCount(chat.id, userId)

      let lastMessage: ChatListItem['lastMessage'] = null
      if (lastMsg) {
        const firstAtt = lastMsg.attachments[0]
        let attachmentPreview: { type: string; url: string } | null = null
        if (firstAtt) {
          const previewKey = firstAtt.thumbnailKey ?? firstAtt.s3Key
          const url = await this.s3.getPresignedUrl(firstAtt.s3Key, PRESIGNED_EXPIRES)
          const thumbUrl = await this.s3.getPresignedUrl(previewKey, PRESIGNED_EXPIRES)
          attachmentPreview = { type: firstAtt.type, url: firstAtt.type === 'IMAGE' ? url : thumbUrl }
        }
        lastMessage = {
          text: lastMsg.text,
          attachmentPreview,
        }
      }

      const avatarUrl = await this.s3.getPresignedAvatarUrl(otherUser.avatarUrl)
      items.push({
        id: chat.id,
        otherUser: { id: otherUser.id, username: otherUser.username, avatarUrl },
        lastMessageAt: lastMsg?.createdAt ?? chat.updatedAt,
        lastMessage,
        unreadCount,
      })
    }
    return items
  }

  async getOrCreateDirectChat(userId: string, otherUserId: string): Promise<string> {
    if (userId === otherUserId) {
      throw new BadRequestException('Cannot create chat with yourself')
    }
    const other = await this.prisma.user.findUnique({ where: { id: otherUserId } })
    if (!other) throw new NotFoundException('User not found')

    const candidates = await this.prisma.chat.findMany({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: { participants: true },
    })
    const existing = candidates.find(
      (c) =>
        c.participants.length === 2 &&
        c.participants.some((p) => p.userId === userId) &&
        c.participants.some((p) => p.userId === otherUserId),
    )
    if (existing) return existing.id

    const chat = await this.prisma.chat.create({
      data: {
        participants: {
          create: [
            { userId },
            { userId: otherUserId },
          ],
        },
      },
    })
    return chat.id
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ messages: MessageWithAttachments[]; nextCursor: string | null }> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    })
    if (!participant) throw new ForbiddenException('Not a participant')

    const limit = Math.min(opts.limit ?? 50, 100)
    const cursor = opts.cursor ? { id: opts.cursor } : undefined

    const messages = await this.prisma.message.findMany({
      where: { chatId },
      cursor,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: { attachments: true },
    })

    const hasMore = messages.length > limit
    const slice = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore ? slice[slice.length - 1].id : null

    const result: MessageWithAttachments[] = []
    for (const m of slice.reverse()) {
      const attachments = await Promise.all(
        m.attachments.map(async (a) => ({
          id: a.id,
          type: a.type,
          s3Key: a.s3Key,
          thumbnailKey: a.thumbnailKey,
          mimeType: a.mimeType,
          size: a.size,
          url: await this.s3.getPresignedUrl(a.s3Key, PRESIGNED_EXPIRES),
          thumbnailUrl: a.thumbnailKey
            ? await this.s3.getPresignedUrl(a.thumbnailKey, PRESIGNED_EXPIRES)
            : null,
        })),
      )
      result.push({
        id: m.id,
        chatId: m.chatId,
        senderId: m.senderId,
        text: m.text,
        createdAt: m.createdAt,
        attachments,
      })
    }
    return { messages: result, nextCursor }
  }

  async markChatRead(chatId: string, userId: string): Promise<void> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    })
    if (!participant) throw new ForbiddenException('Not a participant')
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: new Date() },
    })
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    })
    if (!participant) return 0
    const after = participant.lastReadAt ?? new Date(0)
    return this.prisma.message.count({
      where: {
        chatId,
        senderId: { not: userId },
        createdAt: { gt: after },
      },
    })
  }

  async getUploadUrl(
    chatId: string,
    userId: string,
    dto: UploadChatFileDto,
  ): Promise<UploadUrlResult> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    })
    if (!participant) throw new ForbiddenException('Not a participant')
    if (dto.size > MAX_FILE_SIZE) throw new BadRequestException('File too large')

    this.validateMimeAndType(dto.mimeType, dto.type)

    const ext = dto.filename.includes('.') ? dto.filename.split('.').pop() : 'bin'
    const safeExt = /^[a-z0-9]+$/i.test(ext ?? '') ? ext : 'bin'
    const key = `${CHAT_KEY_PREFIX}${chatId}/${randomUUID()}.${safeExt}`

    const uploadUrl = await this.s3.getPresignedPutUrl(key, dto.mimeType, PRESIGNED_EXPIRES)
    return { uploadUrl, key }
  }

  async createMessage(
    chatId: string,
    senderId: string,
    text?: string | null,
    attachmentKeys?: ChatAttachmentKeyDto[],
  ): Promise<CreatedMessagePayload> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: senderId } },
    })
    if (!participant) throw new ForbiddenException('Not a participant')

    if (!text && (!attachmentKeys || attachmentKeys.length === 0)) {
      throw new BadRequestException('Message must have text or at least one attachment')
    }

    const chatPrefix = this.s3.getChatKeyPrefix()
    const keys = attachmentKeys ?? []
    for (const k of keys) {
      if (!k.s3Key.startsWith(chatPrefix)) {
        throw new BadRequestException('Invalid attachment key')
      }
      if (k.size > MAX_FILE_SIZE) throw new BadRequestException('Attachment too large')
      this.validateMimeAndType(k.mimeType, k.type as ChatAttachmentType)
    }

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId,
        text: text ?? null,
        attachments: {
          create: keys.map((k) => ({
            type: k.type as ChatAttachmentType,
            s3Key: k.s3Key,
            thumbnailKey: k.thumbnailKey ?? null,
            mimeType: k.mimeType,
            size: BigInt(k.size),
          })),
        },
      },
      include: { attachments: true },
    })

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    const recipients = await this.prisma.chatParticipant.findMany({
      where: { chatId, userId: { not: senderId } },
      select: { userId: true },
    })
    const recipientUserIds = recipients.map((r) => r.userId)

    const attachments = await Promise.all(
      message.attachments.map(async (a) => ({
        id: a.id,
        type: a.type,
        s3Key: a.s3Key,
        thumbnailKey: a.thumbnailKey,
        mimeType: a.mimeType,
        size: a.size,
        url: await this.s3.getPresignedUrl(a.s3Key, PRESIGNED_EXPIRES),
        thumbnailUrl: a.thumbnailKey
          ? await this.s3.getPresignedUrl(a.thumbnailKey, PRESIGNED_EXPIRES)
          : null,
      })),
    )

    const payload: MessageWithAttachments = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt,
      attachments,
    }

    return { message: payload, recipientUserIds }
  }

  async getChatByIdAndUser(chatId: string, userId: string): Promise<{ id: string } | null> {
    const p = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { chatId: true },
    })
    return p ? { id: p.chatId } : null
  }

  private validateMimeAndType(mimeType: string, type: ChatAttachmentType): void {
    const allowed =
      type === 'IMAGE'
        ? ALLOWED_MIME_IMAGE
        : type === 'VIDEO'
          ? ALLOWED_MIME_VIDEO
          : ALLOWED_MIME_AUDIO
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid mime type for ${type}. Allowed: ${allowed.join(', ')}`,
      )
    }
  }
}
