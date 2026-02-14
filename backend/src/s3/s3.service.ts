import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'

const AVATAR_KEY_PREFIX = 'avatars/'
const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

@Injectable()
export class S3Service {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly avatarBaseUrl: string

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
    const publicBase = this.config.get<string>('S3_AVATAR_BASE_URL')
    this.avatarBaseUrl =
      publicBase ?? `https://${this.bucket}.s3.${region}.amazonaws.com/${AVATAR_KEY_PREFIX}`
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
