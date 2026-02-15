import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { S3Service } from '../s3/s3.service'
import type { MediaType, MediaStatus } from '@prisma/client'

export type MediaListItem = {
  id: string
  filename: string
  size: number | null
  mimeType: string
  type: MediaType
  status: MediaStatus
  currentStage: string | null
  stageProgress: number | null
  createdAt: Date
  /** Presigned URL для просмотра/скачивания (если файл в S3). Истекает через ~1 ч. */
  viewUrl?: string | null
  /** Presigned URL превью-кадра для видео. Истекает через ~1 ч. */
  thumbnailUrl?: string | null
}

export type MediaListResult = {
  items: MediaListItem[]
  total: number
  page: number
  limit: number
}

@Injectable()
export class ArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly s3: S3Service,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async listByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<MediaListResult> {
    const skip = (page - 1) * limit
    const [rows, total] = await Promise.all([
      this.prisma.media.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          filename: true,
          size: true,
          mimeType: true,
          type: true,
          status: true,
          currentStage: true,
          stageProgress: true,
          createdAt: true,
          s3Key: true,
          thumbnailKey: true,
        },
      }),
      this.prisma.media.count({ where: { userId } }),
    ])
    const [viewUrls, thumbnailUrls] = await Promise.all([
      Promise.all(
        rows.map((m) => (m.s3Key ? this.s3.getPresignedUrl(m.s3Key) : Promise.resolve(null))),
      ),
      Promise.all(
        rows.map((m) =>
          m.thumbnailKey ? this.s3.getPresignedUrl(m.thumbnailKey) : Promise.resolve(null),
        ),
      ),
    ])
    const items: MediaListItem[] = rows.map((m, i) => ({
      id: m.id,
      filename: m.filename,
      size: m.size != null ? Number(m.size) : null,
      mimeType: m.mimeType,
      type: m.type,
      status: m.status,
      currentStage: m.currentStage,
      stageProgress: m.stageProgress ?? null,
      createdAt: m.createdAt,
      viewUrl: viewUrls[i] ?? null,
      thumbnailUrl: thumbnailUrls[i] ?? null,
    }))
    return { items, total, page, limit }
  }

  async getById(userId: string, mediaId: string): Promise<MediaListItem> {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, userId },
      select: {
        id: true,
        filename: true,
        size: true,
        mimeType: true,
        type: true,
        status: true,
        currentStage: true,
        stageProgress: true,
        createdAt: true,
      },
    })
    if (!media) throw new NotFoundException('Media not found')
    return {
      ...media,
      size: media.size != null ? Number(media.size) : null,
      stageProgress: media.stageProgress ?? null,
    }
  }

  /** Для HLS-прокси: медиа по id и userId (только владелец). */
  async getMediaForHls(
    mediaId: string,
    userId: string,
  ): Promise<{ hlsPlaylistKey: string | null } | null> {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, userId },
      select: { hlsPlaylistKey: true },
    })
    return media
  }

  /** URL для просмотра: для видео с HLS — плейлист с токеном, иначе presigned S3. */
  async getMediaViewUrl(userId: string, mediaId: string): Promise<string | null> {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, userId },
      select: { s3Key: true, hlsPlaylistKey: true },
    })
    if (!media) return null
    if (media.hlsPlaylistKey) {
      const baseUrl = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3001').replace(/\/$/, '')
      const token = this.jwt.sign(
        { sub: userId, mediaId, purpose: 'hls' },
        { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '1h' },
      )
      return `${baseUrl}/archive/${mediaId}/hls/playlist.m3u8?token=${token}`
    }
    if (!media.s3Key) return null
    return this.s3.getPresignedUrl(media.s3Key)
  }

  async deleteMedia(userId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, userId },
      select: { id: true, s3Key: true, thumbnailKey: true, hlsPlaylistKey: true, size: true },
    })
    if (!media) throw new NotFoundException('Media not found')

    try {
      if (media.s3Key) await this.s3.deleteObject(media.s3Key)
      if (media.thumbnailKey) await this.s3.deleteObject(media.thumbnailKey)
      if (media.hlsPlaylistKey) {
        const hlsPrefix = media.hlsPlaylistKey.replace(/\/playlist\.m3u8$/, '')
        await this.s3.deleteObjectsByPrefix(hlsPrefix)
      }
    } finally {
      if (media.s3Key != null && media.size != null && media.size > 0n) {
        await this.storage.subtractUsage(userId, Number(media.size))
      }
      await this.prisma.media.delete({ where: { id: mediaId } })
    }
  }

  async createMedia(params: {
    userId: string
    filename: string
    mimeType: string
    type: MediaType
    size?: number
    s3Key?: string
    jobId?: string
  }) {
    return this.prisma.media.create({
      data: {
        userId: params.userId,
        filename: params.filename,
        mimeType: params.mimeType,
        type: params.type,
        size: params.size != null ? BigInt(params.size) : null,
        s3Key: params.s3Key,
        jobId: params.jobId,
        status: 'UPLOADING',
        currentStage: 'uploading',
      },
    })
  }

  async updateMediaProgress(
    mediaId: string,
    data: {
      currentStage?: string
      stageProgress?: number
      status?: MediaStatus
      size?: number
      s3Key?: string
      thumbnailKey?: string
      hlsPlaylistKey?: string
      jobId?: string
    },
  ) {
    const update: Record<string, unknown> = {}
    if (data.currentStage !== undefined) update.currentStage = data.currentStage
    if (data.stageProgress !== undefined) update.stageProgress = data.stageProgress
    if (data.status !== undefined) update.status = data.status
    if (data.size !== undefined) update.size = BigInt(data.size)
    if (data.s3Key !== undefined) update.s3Key = data.s3Key
    if (data.thumbnailKey !== undefined) update.thumbnailKey = data.thumbnailKey
    if (data.hlsPlaylistKey !== undefined) update.hlsPlaylistKey = data.hlsPlaylistKey
    if (data.jobId !== undefined) update.jobId = data.jobId
    return this.prisma.media.update({
      where: { id: mediaId },
      data: update,
    })
  }
}
