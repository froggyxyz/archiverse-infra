import { Controller, Get, Delete, Param, Query, UseGuards, Res, UnauthorizedException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'
import type { AuthUser } from '../auth/auth.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { S3Service } from '../s3/s3.service'
import { ArchiveService, type MediaListItem, type MediaListResult } from './archive.service'
import { ListArchiveDto } from './dto/list-archive.dto'

@Controller('archive')
export class ArchiveController {
  constructor(
    private readonly archive: ArchiveService,
    private readonly s3: S3Service,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser() user: AuthUser,
    @Query() dto: ListArchiveDto,
  ): Promise<MediaListResult> {
    return this.archive.listByUser(
      user.id,
      dto.page ?? 1,
      dto.limit ?? 20,
    )
  }

  @Get(':id/hls/playlist.m3u8')
  async getHlsPlaylist(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const payload = this.verifyHlsToken(token, id)
    const media = await this.archive.getMediaForHls(id, payload.userId)
    if (!media?.hlsPlaylistKey) throw new NotFoundException()
    let stream: NodeJS.ReadableStream
    let contentType: string | undefined
    try {
      const result = await this.s3.getObjectStream(media.hlsPlaylistKey)
      stream = result.stream
      contentType = result.contentType
    } catch (err: unknown) {
      const code = (err as { Code?: string })?.Code
      if (code === 'NoSuchKey') throw new NotFoundException()
      throw err
    }
    const chunks: Buffer[] = []
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    let body = Buffer.concat(chunks).toString('utf8')
    const tokenQ = `?token=${encodeURIComponent(token)}`
    body = body.replace(/^(segment_\d+\.ts)$/gm, (m) => m + tokenQ)
    body = body.replace(/^(stream_\d+\.m3u8)$/gm, (m) => m + tokenQ)
    res.setHeader('Content-Type', contentType ?? 'application/vnd.apple.mpegurl')
    res.send(body)
  }

  /** Один сегмент или вариант-плейлист (stream_0.m3u8, stream_0/segment_000.ts и т.д.). */
  @Get(':id/hls/*path')
  async getHlsSegment(
    @Param('id') id: string,
    @Param('path') path: string | string[],
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const pathStr = typeof path === 'string' ? path : Array.isArray(path) ? path.join('/') : ''
    const payload = this.verifyHlsToken(token, id)
    const media = await this.archive.getMediaForHls(id, payload.userId)
    if (!media?.hlsPlaylistKey) throw new NotFoundException()
    const dir = media.hlsPlaylistKey.replace(/\/playlist\.m3u8$/, '')
    const key = pathStr ? `${dir}/${pathStr}` : dir
    let stream: NodeJS.ReadableStream
    let contentType: string | undefined
    try {
      const result = await this.s3.getObjectStream(key)
      stream = result.stream
      contentType = result.contentType
    } catch (err: unknown) {
      const code = (err as { Code?: string })?.Code
      if (code === 'NoSuchKey') throw new NotFoundException()
      throw err
    }
    const isM3u8 = pathStr.endsWith('.m3u8')
    res.setHeader('Content-Type', isM3u8 ? 'application/vnd.apple.mpegurl' : 'video/MP2T')
    if (isM3u8) {
      const chunks: Buffer[] = []
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      let body = Buffer.concat(chunks).toString('utf8')
      const tokenQ = `?token=${encodeURIComponent(token)}`
      const streamMatch = pathStr.match(/^stream_(\d+)\.m3u8$/)
      const segmentPrefix = streamMatch ? `stream_${streamMatch[1]}/` : ''
      body = body.replace(/^(segment_\d+\.ts)$/gm, (m) => segmentPrefix + m + tokenQ)
      res.send(body)
    } else {
      ;(stream as NodeJS.ReadableStream).pipe(res)
    }
  }

  private verifyHlsToken(token: string, mediaId: string): { userId: string } {
    if (!token) throw new UnauthorizedException()
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      }) as { sub?: string; mediaId?: string; purpose?: string }
      if (payload.purpose !== 'hls' || payload.mediaId !== mediaId || !payload.sub) {
        throw new UnauthorizedException()
      }
      return { userId: payload.sub }
    } catch {
      throw new UnauthorizedException()
    }
  }

  @Get(':id/view-url')
  @UseGuards(JwtAuthGuard)
  async getViewUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ url: string } | { url: null }> {
    const url = await this.archive.getMediaViewUrl(user.id, id)
    return { url: url ?? null }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<MediaListItem> {
    return this.archive.getById(user.id, id)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.archive.deleteMedia(user.id, id)
  }
}
