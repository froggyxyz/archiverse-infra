import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { Server } from '@tus/server'
import { FileStore } from '@tus/file-store'
import type { Upload } from '@tus/utils'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { StorageService } from '../storage/storage.service'
import { ArchiveService } from './archive.service'
import { S3Service } from '../s3/s3.service'
import { ARCHIVE_MEDIA_STAGES } from './archive.constants'
import { ARCHIVE_QUEUE_NAME, type ArchiveJobPayload } from './archive.processor'
import type { MediaType } from '@prisma/client'

const UPLOAD_PATH = '/archive/upload'
const TUS_UPLOAD_DIR = 'tus-uploads'

// uploadId -> userId, for auth on PATCH/HEAD
const uploadOwners = new Map<string, string>()

function getMediaType(mime: string): MediaType {
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (mime.startsWith('image/')) return 'IMAGE'
  return 'VIDEO'
}

@Injectable()
export class TusService implements OnModuleInit {
  private server!: Server

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    private readonly archive: ArchiveService,
    private readonly s3: S3Service,
    @InjectQueue(ARCHIVE_QUEUE_NAME) private readonly archiveQueue: Queue<ArchiveJobPayload>,
  ) {}

  onModuleInit() {
    const uploadDir = this.config.get('TUS_UPLOAD_PATH', join(process.cwd(), TUS_UPLOAD_DIR))
    const datastore = new FileStore({ directory: uploadDir })
    this.server = new Server({
      path: UPLOAD_PATH,
      datastore,
      allowedCredentials: true,
      onIncomingRequest: async (req: unknown, uploadId: string) => {
        const r = req as { headers: Headers; runtime?: { node?: { req?: { headers?: { authorization?: string } } } } }
        const auth = r.headers.get('authorization') ?? r.runtime?.node?.req?.headers?.authorization
        const token = auth?.replace(/^Bearer\s+/i, '')
        if (!token) {
          throw { status_code: 401, body: 'Unauthorized\n' }
        }
        let userId: string
        try {
          const payload = this.jwt.verify(token, {
            secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
          }) as { sub?: string }
          userId = payload.sub!
          if (!userId) throw new Error()
        } catch {
          throw { status_code: 401, body: 'Unauthorized\n' }
        }
        if (uploadId) {
          const owner = uploadOwners.get(uploadId)
          if (owner !== userId) throw { status_code: 404, body: 'Not found\n' }
        } else {
          ;(r as Record<string, unknown>).__userId = userId
        }
      },
      onUploadCreate: async (req: unknown, upload: { id: string }) => {
        const r = req as { headers: Headers } & Record<string, unknown>
        const userId = r.__userId as string
        if (!userId) throw { status_code: 401, body: 'Unauthorized\n' }
        const sizeHeader = r.headers.get('upload-length')
        const size = sizeHeader ? parseInt(sizeHeader, 10) : 0
        if (size > 0) {
          const { allowed } = await this.storage.checkQuota(userId, size)
          if (!allowed) throw { status_code: 413, body: 'Storage quota exceeded\n' }
        }
        uploadOwners.set(upload.id, userId)
        return {}
      },
      onUploadFinish: async (_req: unknown, upload: Upload) => {
        const userId = uploadOwners.get(upload.id)
        if (!userId) return {}
        uploadOwners.delete(upload.id)
        const filename = upload.metadata?.filename
          ? Buffer.from(upload.metadata.filename, 'base64').toString('utf8')
          : `file-${upload.id}`
        const filetype = upload.metadata?.filetype
          ? Buffer.from(upload.metadata.filetype, 'base64').toString('utf8')
          : 'application/octet-stream'
        const type = getMediaType(filetype)
        const ext = filetype.split('/')[1] ?? 'bin'
        const size = upload.size ?? 0
        const media = await this.archive.createMedia({
          userId,
          filename: filename || `file.${ext}`,
          mimeType: filetype,
          type,
          size,
        })
        const s3Key = `archive/${userId}/${media.id}.${ext}`
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        const uploadDir = this.config.get('TUS_UPLOAD_PATH', join(process.cwd(), TUS_UPLOAD_DIR))
        const filePath = path.join(uploadDir, upload.id)
        try {
          const buffer = await fs.readFile(filePath)
          await this.s3.uploadBuffer(s3Key, buffer, filetype)
          await this.archive.updateMediaProgress(media.id, {
            status: 'PROCESSING',
            currentStage: ARCHIVE_MEDIA_STAGES.UPLOADED,
            stageProgress: 1,
            size,
            s3Key,
          })
          await this.storage.addUsage(userId, size)
          const bullJob = await this.archiveQueue.add('process', {
            mediaId: media.id,
            userId,
            s3Key,
          } satisfies ArchiveJobPayload)
          await this.archive.updateMediaProgress(media.id, { jobId: bullJob.id })
        } finally {
          await fs.unlink(filePath).catch(() => {})
        }
        return {}
      },
    })
  }

  handle(req: IncomingMessage, res: ServerResponse): void {
    this.server.handle(req, res)
  }
}
