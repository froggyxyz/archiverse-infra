import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Server } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { ArchiveProgressService } from './archive-progress.service'
import type { Socket } from 'socket.io'

const USER_ROOM_PREFIX = 'user:'

/**
 * Событие для фронта: archive:progress
 * Payload: { mediaId: string, stage: string, progress: number }
 * stage: uploading | uploaded | validating | compressing | transcoding | completed | failed
 * progress: 0..1 в рамках текущего этапа
 * Подключение: auth.token или query.token — JWT access token. Сокет добавляется в комнату user:userId.
 */

@WebSocketGateway({
  cors: { origin: true },
  transports: ['websocket'],
})
export class ArchiveGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly progress: ArchiveProgressService,
  ) {}

  afterInit(): void {
    this.progress.setMessageHandler((data) => {
      this.server
        .to(`${USER_ROOM_PREFIX}${data.userId}`)
        .emit('archive:progress', {
          mediaId: data.mediaId,
          stage: data.stage,
          progress: data.progress,
        })
    })
  }

  handleConnection(client: Socket): void {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string)
    if (!token) {
      client.disconnect()
      return
    }
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      }) as { sub?: string }
      const userId = payload.sub
      if (!userId) {
        client.disconnect()
        return
      }
      client.join(`${USER_ROOM_PREFIX}${userId}`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(): void {
    // no-op
  }
}
