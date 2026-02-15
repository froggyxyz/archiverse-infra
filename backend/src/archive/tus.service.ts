import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { toNodeHandler } from 'srvx/node'
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

const UPLOAD_PATH = '/tus/archive'
const TUS_UPLOAD_DIR = 'tus-uploads'

// uploadId -> userId, for auth on PATCH/HEAD
const uploadOwners = new Map<string, string>()

function getMediaType(mime: string): MediaType {
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (mime.startsWith('image/')) return 'IMAGE'
  return 'VIDEO'
}

/** Убирает символы, недопустимые в HTTP-заголовках (S3/Node выбросит ERR_INVALID_CHAR). */
function sanitizeContentType(value: string): string {
  const sanitized = value.replace(/[\r\n\x00-\x1f]/g, '').trim()
  return /^[\x20-\x7e]+$/.test(sanitized) && sanitized.length > 0
    ? sanitized
    : 'application/octet-stream'
}

@Injectable()
export class TusService implements OnModuleInit {
  private readonly logger = new Logger(TusService.name)
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
        // Для POST uploadId — новый id (ещё нет в uploadOwners). Для PATCH/HEAD — проверяем владельца.
        if (uploadId && uploadOwners.has(uploadId)) {
          const owner = uploadOwners.get(uploadId)
          if (owner !== userId) throw { status_code: 404, body: 'Not found\n' }
        }
        ;(r as Record<string, unknown>).__userId = userId
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
        if (!userId) {
          this.logger.warn(`onUploadFinish: no owner for upload ${upload.id}, skipping`)
          return {}
        }
        uploadOwners.delete(upload.id)
        this.logger.log(`onUploadFinish: uploadId=${upload.id} userId=${userId} size=${upload.size ?? 0}`)
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        const uploadDir = this.config.get('TUS_UPLOAD_PATH', join(process.cwd(), TUS_UPLOAD_DIR))
        const filePath = path.join(uploadDir, upload.id)
        const filename =
          typeof upload.metadata?.filename === 'string' && upload.metadata.filename.length > 0
            ? upload.metadata.filename
            : `file-${upload.id}`
        const rawFiletype =
          typeof upload.metadata?.filetype === 'string' && upload.metadata.filetype.length > 0
            ? upload.metadata.filetype
            : 'application/octet-stream'
        const filetype = sanitizeContentType(rawFiletype)
        const type = getMediaType(filetype)
        const ext = filetype.split('/')[1] ?? 'bin'
        const size = upload.size ?? 0
        const media = await this.archive.createMedia({
          userId,
          filename: (filename || `file.${ext}`).replace(/[\r\n\x00-\x1f]/g, '').trim() || `file.${ext}`,
          mimeType: filetype,
          type,
          size,
        })
        // Тяжёлую работу (чтение файла, S3) — в фоне, чтобы последний PATCH сразу получил 204 и не таймаутил
        void (async () => {
          try {
            this.logger.log(`onUploadFinish: created media ${media.id}, reading file ${filePath}`)
            const buffer = await fs.readFile(filePath)
            const s3Key = `archive/${userId}/${media.id}.${ext}`
            await this.s3.uploadBuffer(s3Key, buffer, filetype)
            this.logger.log(`onUploadFinish: uploaded to S3 ${s3Key}`)
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
            this.logger.log(`archive job queued mediaId=${media.id} jobId=${bullJob.id}`)
            await this.archive.updateMediaProgress(media.id, { jobId: bullJob.id })
          } catch (err) {
            this.logger.error(
              `onUploadFinish background failed uploadId=${upload.id} mediaId=${media.id}`,
              err instanceof Error ? err.stack : String(err),
            )
            await this.archive
              .updateMediaProgress(media.id, {
                status: 'FAILED',
                currentStage: ARCHIVE_MEDIA_STAGES.FAILED,
                stageProgress: 0,
              })
              .catch(() => {})
          } finally {
            await fs.unlink(filePath).catch(() => {})
            const metaPath = path.join(uploadDir, `${upload.id}.json`)
            await fs.unlink(metaPath).catch(() => {})
          }
        })()
        return {}
      },
    })
    // srvx NodeRequest не выставляет .body; передаём в handler реальный Web Request (request._request).
    const boundHandler = (this.server as unknown as { handler: (req: Request) => Promise<Response> }).handler.bind(this.server)
    this.server.handle = (nodeReq: IncomingMessage, nodeRes: ServerResponse): Promise<void> => {
      const wrappedHandler = (req: unknown) =>
        boundHandler((req as { _request?: Request })._request ?? (req as Request))
      const result = toNodeHandler(wrappedHandler)(nodeReq, nodeRes)
      return result instanceof Promise ? result : Promise.resolve()
    }
  }

  handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (process.env.TUS_DEBUG === '1') {
      const r = req as IncomingMessage & { method?: string; url?: string }
      console.log('[TUS TusService.handle] req.method=%s req.url=%s', r.method, r.url)
    }
    return this.server.handle(req, res)
  }
}
