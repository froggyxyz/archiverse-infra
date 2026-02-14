import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
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
  ) {}

  async listByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<MediaListResult> {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
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
        },
      }),
      this.prisma.media.count({ where: { userId } }),
    ])
    return {
      items: items.map((m) => ({
        ...m,
        size: m.size != null ? Number(m.size) : null,
        stageProgress: m.stageProgress ?? null,
      })),
      total,
      page,
      limit,
    }
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

  async deleteMedia(userId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, userId },
    })
    if (!media) throw new NotFoundException('Media not found')
    if (media.size != null && media.size > 0n) {
      await this.storage.subtractUsage(userId, Number(media.size))
    }
    await this.prisma.media.delete({ where: { id: mediaId } })
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
      jobId?: string
    },
  ) {
    const update: Record<string, unknown> = {}
    if (data.currentStage !== undefined) update.currentStage = data.currentStage
    if (data.stageProgress !== undefined) update.stageProgress = data.stageProgress
    if (data.status !== undefined) update.status = data.status
    if (data.size !== undefined) update.size = BigInt(data.size)
    if (data.s3Key !== undefined) update.s3Key = data.s3Key
    if (data.jobId !== undefined) update.jobId = data.jobId
    return this.prisma.media.update({
      where: { id: mediaId },
      data: update,
    })
  }
}
