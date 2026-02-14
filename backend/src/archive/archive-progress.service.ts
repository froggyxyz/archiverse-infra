import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

const CHANNEL = 'archive:progress'

export type ArchiveProgressPayload = {
  userId: string
  mediaId: string
  stage: string
  progress: number
}

@Injectable()
export class ArchiveProgressService implements OnModuleDestroy {
  private pub: Redis | null = null
  private sub: Redis | null = null
  private handler: ((data: ArchiveProgressPayload) => void) | null = null
  private subscribed = false

  constructor(private readonly config: ConfigService) {}

  private getPub(): Redis {
    if (!this.pub) {
      const url = this.config.get<string>('REDIS_URL')
      this.pub = url
        ? new Redis(url, { maxRetriesPerRequest: null })
        : new Redis({
            host: this.config.get('REDIS_HOST', 'localhost'),
            port: this.config.get<number>('REDIS_PORT', 6379),
            maxRetriesPerRequest: null,
          })
    }
    return this.pub
  }

  private getSub(): Redis {
    if (!this.sub) {
      const url = this.config.get<string>('REDIS_URL')
      this.sub = url
        ? new Redis(url, { maxRetriesPerRequest: null })
        : new Redis({
            host: this.config.get('REDIS_HOST', 'localhost'),
            port: this.config.get<number>('REDIS_PORT', 6379),
            maxRetriesPerRequest: null,
          })
      this.sub.on('message', (_ch: string, msg: string) => {
        try {
          const data = JSON.parse(msg) as ArchiveProgressPayload
          this.handler?.(data)
        } catch {
          // ignore
        }
      })
    }
    return this.sub
  }

  publish(data: ArchiveProgressPayload): void {
    this.getPub().publish(CHANNEL, JSON.stringify(data))
  }

  setMessageHandler(cb: (data: ArchiveProgressPayload) => void): void {
    this.handler = cb
    if (!this.subscribed) {
      this.getSub().subscribe(CHANNEL)
      this.subscribed = true
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pub?.quit()
    await this.sub?.quit()
    this.pub = null
    this.sub = null
  }
}
