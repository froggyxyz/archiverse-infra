import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const AVATAR_KEY_PREFIX = 'avatars/'
const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PRESIGNED_AVATAR_EXPIRES_IN = 3600 // 1 hour
const PRESIGNED_ARCHIVE_EXPIRES_IN = 3600 // 1 hour

@Injectable()
export class S3Service {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly avatarBaseUrl: string
  private readonly hasCredentials: boolean

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT')
    const region = this.config.get<string>('S3_REGION', 'us-east-1')
    this.client = new S3Client({
      region,
      ...(endpoint && { endpoint, forcePathStyle: true }),
      credentials: this.config.get('S3_ACCESS_KEY')
        ? {
            accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
            secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
          }
        : undefined,
    })
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET')
    this.hasCredentials = !!this.config.get('S3_ACCESS_KEY')
    const publicBase = this.config.get<string>('S3_AVATAR_BASE_URL')?.trim()
    this.avatarBaseUrl =
      publicBase && publicBase.length > 0
        ? publicBase
        : `https://${this.bucket}.s3.${region}.amazonaws.com/${AVATAR_KEY_PREFIX}`
  }

  /** Стрим объекта из S3 (для HLS сегментов и т.д.). */
  async getObjectStream(key: string): Promise<{
    stream: NodeJS.ReadableStream
    contentType?: string
  }> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    const body = res.Body as NodeJS.ReadableStream | undefined
    if (!body) throw new Error('Empty S3 body')
    return {
      stream: body,
      contentType: res.ContentType ?? undefined,
    }
  }

  /** Скачать объект из S3 в Buffer. */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    const body = res.Body
    if (!body) return Buffer.alloc(0)
    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  /** Presigned GetObject URL для любого ключа в бакете (архив, аватар и т.д.). */
  async getPresignedUrl(key: string, expiresIn = PRESIGNED_ARCHIVE_EXPIRES_IN): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    )
  }

  async getPresignedAvatarUrl(avatarUrl: string | null): Promise<string | null> {
    if (!avatarUrl || !this.hasCredentials) return avatarUrl
    const key = this.extractAvatarKeyFromUrl(avatarUrl)
    if (!key) return avatarUrl
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: PRESIGNED_AVATAR_EXPIRES_IN },
    )
    return url
  }

  private extractAvatarKeyFromUrl(url: string): string | null {
    const match = url.includes('/avatars/') && url.split('/avatars/').pop()?.split('?')[0]?.trim()
    if (!match) return null
    return `${AVATAR_KEY_PREFIX}${match}`
  }

  /** Удалить один объект по ключу. */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: [{ Key: key }] },
      }),
    )
  }

  /** Удалить все объекты с заданным префиксом (пагинация по 1000). */
  async deleteObjectsByPrefix(prefix: string): Promise<void> {
    const prefixNorm = prefix.endsWith('/') ? prefix : `${prefix}/`
    let continuationToken: string | undefined
    do {
      const list = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefixNorm,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        }),
      )
      const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k)
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        )
      }
      continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined
    } while (continuationToken)
  }

  async deleteUserAvatars(userId: string): Promise<void> {
    const prefix = `${AVATAR_KEY_PREFIX}${userId}.`
    const list = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
    )
    const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k)
    if (keys.length === 0) return
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    )
  }

  async uploadBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<string> {
    if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
      throw new Error(
        `Invalid type. Allowed: ${ALLOWED_AVATAR_TYPES.join(', ')}`,
      )
    }
    if (file.buffer.length > MAX_AVATAR_SIZE) {
      throw new Error(`File too large. Max ${MAX_AVATAR_SIZE / 1024 / 1024} MB`)
    }
    await this.deleteUserAvatars(userId)
    const ext = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1] ?? 'jpg'
    const key = `${AVATAR_KEY_PREFIX}${userId}.${ext}`
    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }
    await this.client.send(new PutObjectCommand(input))
    const base = this.avatarBaseUrl.replace(/\/$/, '')
    return `${base}/${userId}.${ext}`
  }
}
