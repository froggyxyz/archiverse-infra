import { Logger } from '@nestjs/common'
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

/** Варианты качества: разрешение (height) + битрейт (k). Включаем только renditions <= высоты источника (без апскейла). */
const HLS_RENDITIONS = [
  { height: 1080, bitrateK: 5000 },
  { height: 720, bitrateK: 3000 },
  { height: 480, bitrateK: 1000 },
  { height: 360, bitrateK: 500 },
] as const

async function listFilesRecursive(dirPath: string, base = ''): Promise<string[]> {
  const entries = await readdir(join(dirPath, base), { withFileTypes: true })
  const files: string[] = []
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isFile()) files.push(rel)
    else if (e.isDirectory()) files.push(...(await listFilesRecursive(dirPath, rel)))
  }
  return files
}

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

/** Размеры видео через ffprobe. */
function getVideoDimensions(inputPath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      inputPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    proc.stdout?.on('data', (chunk: Buffer) => { out += chunk.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(out) as { streams?: Array<{ width?: number; height?: number }> }
          const s = data.streams?.[0]
          const w = s?.width ?? 1920
          const h = s?.height ?? 1080
          resolve({ width: w, height: h })
        } catch {
          resolve({ width: 1920, height: 1080 })
        }
      } else reject(new Error(`ffprobe exit ${code}`))
    })
    proc.on('error', reject)
  })
}

/** Длительность в секундах через ffprobe. */
function getDurationSeconds(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    proc.stdout?.on('data', (chunk: Buffer) => { out += chunk.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        const sec = parseFloat(out.trim())
        resolve(Number.isFinite(sec) && sec > 0 ? sec : 0)
      } else reject(new Error(`ffprobe exit ${code}`))
    })
    proc.on('error', reject)
  })
}

/** time= из stderr ffmpeg (HH:MM:SS.ms) в секунды. */
function parseTimeStr(s: string): number | null {
  const m = s.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
  if (!m) return null
  const [, h, min, sec, ms] = m.map(Number)
  return h * 3600 + min * 60 + sec + ms / 100
}

/** Запуск ffmpeg с колбэком прогресса 0..1 (по time= в stderr). */
function runFfmpegWithProgress(
  args: string[],
  inputPath: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    getDurationSeconds(inputPath).then((durationSec) => {
      if (durationSec <= 0) {
        runFfmpeg(args).then(resolve).catch(reject)
        return
      }
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const stderr: Buffer[] = []
      let lastProgress = -1
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr.push(chunk)
        const text = chunk.toString()
        const sec = parseTimeStr(text)
        if (sec != null) {
          const p = Math.min(1, sec / durationSec)
          if (p - lastProgress >= 0.05 || p >= 1) {
            lastProgress = p
            onProgress(p)
          }
        }
      })
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exit ${code}: ${Buffer.concat(stderr).toString().slice(-500)}`))
      })
      proc.on('error', reject)
    }).catch(reject)
  })
}

@Processor(ARCHIVE_QUEUE_NAME)
export class ArchiveProcessor extends WorkerHost {
  private readonly logger = new Logger(ArchiveProcessor.name)

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
    this.logger.log(`job started mediaId=${mediaId} s3Key=${s3Key}`)
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
          this.logger.log(`mediaId=${mediaId}: downloading from S3`)
          const videoBuffer = await this.s3.getObjectBuffer(s3Key)
          await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0.4)
          const inputPath = join(workDir, 'input')
          const thumbPath = join(workDir, 'thumb.jpg')
          await writeFile(inputPath, videoBuffer)
          await setStage(ARCHIVE_MEDIA_STAGES.VALIDATING, 0.5)
          this.logger.log(`mediaId=${mediaId}: generating thumb`)
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
          this.logger.log(`mediaId=${mediaId}: thumb uploaded, starting HLS transcoding (may take several minutes)`)
          await setStage(ARCHIVE_MEDIA_STAGES.TRANSCODING, 0)
          const { height: srcH } = await getVideoDimensions(inputPath)
          type Rendition = { height: number; bitrateK: number }
          let renditions: Rendition[] = HLS_RENDITIONS.filter((r) => r.height <= srcH)
          if (renditions.length === 0) {
            this.logger.warn(`mediaId=${mediaId}: source height ${srcH} < 360, using source resolution`)
            renditions = [{ height: srcH, bitrateK: 500 }]
          }
          const hlsDir = join(workDir, 'hls')
          const { mkdir } = await import('node:fs/promises')
          await mkdir(hlsDir, { recursive: true })
          const n = renditions.length
          const splitChain = `[0:v]split=${n}${renditions.map((_, i) => `[v${i}]`).join('')}`
          const scaleChains = renditions
            .map((r, i) => `[v${i}]scale=w=-2:h=${Math.min(r.height, srcH)}[v${i}s]`)
            .join(';')
          const filterComplex = `${splitChain};${scaleChains}`
          const mapArgs = renditions.flatMap((_, i) => ['-map', `[v${i}s]`, '-map', '0:a'])
          const bvArgs = renditions.flatMap((r, i) => ['-b:v:' + i, r.bitrateK + 'k'])
          const varStreamMap = renditions.map((_, i) => `v:${i},a:${i}`).join(' ')
          const ffmpegArgs = [
            '-i', inputPath,
            '-filter_complex', filterComplex,
            ...mapArgs,
            ...bvArgs,
            '-c:v', 'libx264', '-c:a', 'aac',
            '-hls_time', String(HLS_SEGMENT_DURATION),
            '-hls_playlist_type', 'vod',
            '-hls_flags', 'independent_segments',
            '-hls_segment_filename', join(hlsDir, 'stream_%v/segment_%03d.ts'),
            '-master_pl_name', 'playlist.m3u8',
            '-var_stream_map', varStreamMap,
            '-y', join(hlsDir, 'stream_%v.m3u8'),
          ]
          await runFfmpegWithProgress(ffmpegArgs, inputPath, (p) => {
            void setStage(ARCHIVE_MEDIA_STAGES.TRANSCODING, p * 0.7)
          })
          this.logger.log(`mediaId=${mediaId}: HLS transcoding done, uploading segments to S3`)
          await setStage(ARCHIVE_MEDIA_STAGES.TRANSCODING, 0.7)
          const hlsPrefix = `${HLS_PREFIX}/${userId}/${mediaId}`
          const files = await listFilesRecursive(hlsDir)
          for (const rel of files) {
            const buf = await readFile(join(hlsDir, rel))
            const contentType = rel.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T'
            await this.s3.uploadBuffer(`${hlsPrefix}/${rel}`, buf, contentType)
          }
          await this.archive.updateMediaProgress(mediaId, {
            hlsPlaylistKey: `${hlsPrefix}/playlist.m3u8`,
          })
          await setStage(ARCHIVE_MEDIA_STAGES.TRANSCODING, 1)
          this.logger.log(`mediaId=${mediaId}: job completed`)
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
      this.logger.error(`job failed mediaId=${mediaId}`, err instanceof Error ? err.stack : String(err))
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
