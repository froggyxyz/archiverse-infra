import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import { S3Service } from '../s3/s3.service'
import { ArchiveService } from './archive.service'
import { ArchiveProgressService } from './archive-progress.service'
import { ARCHIVE_MEDIA_STAGES } from './archive.constants'

const HLS_SEGMENT_DURATION = 6
const HLS_PREFIX = 'archive'

export const ARCHIVE_QUEUE_NAME = 'archive'

export type ArchiveJobPayload = {
  mediaId: string
  userId: string
  s3Key: string
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stderr: Buffer[] = []
    proc.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${Buffer.concat(stderr).toString().slice(-500)}`))
    })
    proc.on('error', reject)
  })
}

@Processor(ARCHIVE_QUEUE_NAME)
export class ArchiveProcessor extends WorkerHost {
  constructor(
    private readonly archive: ArchiveService,
    private readonly progress: ArchiveProgressService,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {
    super()
  }

  async process(job: Job<ArchiveJobPayload>): Promise<void> {
    const { mediaId, userId, s3Key } = job.data
    const emit = (stage: string, progress: number) => {
      this.progress.publish({ userId, mediaId, stage, progress })
    }
    try {
      const setStage = async (stage: string, progress: number) => {
        emit(stage, progress)
        await job.updateProgress({ stage, progress })
        await this.archive.updateMediaProgress(mediaId, {
          currentStage: stage,
          stageProgress: progress,
        })
      }

      await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0)

      const media = await this.prisma.media.findFirst({
        where: { id: mediaId, userId },
        select: { type: true },
      })
      if (media?.type === 'VIDEO' && s3Key) {
        const thumbKey = `archive/${userId}/${mediaId}.thumb.jpg`
        const workDir = await mkdtemp(join(tmpdir(), 'archive-thumb-'))
        try {
          await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0.2)
          const videoBuffer = await this.s3.getObjectBuffer(s3Key)
          await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0.4)
          const inputPath = join(workDir, 'input')
          const thumbPath = join(workDir, 'thumb.jpg')
          await writeFile(inputPath, videoBuffer)
          await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0.5)
          await runFfmpeg([
            '-ss', '1',
            '-i', inputPath,
            '-vframes', '1',
            '-q:v', '2',
            '-y',
            thumbPath,
          ])
          await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0.8)
          const thumbBuffer = await readFile(thumbPath)
          await this.s3.uploadBuffer(thumbKey, thumbBuffer, 'image/jpeg')
          await this.archive.updateMediaProgress(mediaId, { thumbnailKey: thumbKey })

          await setStage(ARCHIVE_MEDIA_STAGES.TRANSCODING, 0)
          const hlsDir = join(workDir, 'hls')
          const { mkdir } = await import('node:fs/promises')
          await mkdir(hlsDir, { recursive: true })
          const playlistPath = join(hlsDir, 'playlist.m3u8')
          await runFfmpeg([
            '-i', inputPath,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-hls_time', String(HLS_SEGMENT_DURATION),
            '-hls_playlist_type', 'vod',
            '-hls_segment_filename', join(hlsDir, 'segment_%d.ts'),
            '-f', 'hls',
            '-y',
            playlistPath,
          ])
          await setStage(ARCHIVE_MEDIA_STAGES.TRANSCODING, 0.7)
          const hlsPrefix = `${HLS_PREFIX}/${userId}/${mediaId}`
          const files = await readdir(hlsDir)
          for (const name of files) {
            const buf = await readFile(join(hlsDir, name))
            const contentType = name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T'
            await this.s3.uploadBuffer(`${hlsPrefix}/${name}`, buf, contentType)
          }
          await this.archive.updateMediaProgress(mediaId, {
            hlsPlaylistKey: `${hlsPrefix}/playlist.m3u8`,
          })
          await setStage(ARCHIVE_MEDIA_STAGES.TRANSCODING, 1)
        } finally {
          await rm(workDir, { recursive: true, force: true })
        }
      } else {
        await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0.5)
      }

      emit(ARCHIVE_MEDIA_STAGES.COMPLETED, 1)
      await job.updateProgress({ stage: ARCHIVE_MEDIA_STAGES.COMPLETED, progress: 1 })
      await this.archive.updateMediaProgress(mediaId, {
        status: 'COMPLETED',
        currentStage: ARCHIVE_MEDIA_STAGES.COMPLETED,
        stageProgress: 1,
      })
    } catch (err) {
      emit(ARCHIVE_MEDIA_STAGES.FAILED, 0)
      await this.archive.updateMediaProgress(mediaId, {
        status: 'FAILED',
        currentStage: ARCHIVE_MEDIA_STAGES.FAILED,
        stageProgress: 0,
      })
      throw err
    }
  }
}
