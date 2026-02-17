import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { Socket } from 'socket.io'
import { RoomsService } from './rooms.service'
import { RoomJoinDto } from './dto/room-join.dto'
import { PlayerStateSocketDto } from './dto/player-state-socket.dto'
import { RoomChatSendDto } from './dto/room-chat-send.dto'

const ROOM_PREFIX = 'room:'

type SocketData = {
  userId?: string
  joinedRoomIds?: Set<string>
}

/**
 * События:
 * - room:join (client) -> { roomId } — войти в комнату (participant), рассылается participant:list
 * - room:leave (client) -> { roomId }
 * - player:state (client) -> { roomId, playing?, currentTime?, mediaId? } — рассылается в комнату
 * - chat:send (client) -> { roomId, text } — сохраняется, рассылается chat:message в комнату
 * - participant:list (server) -> список участников
 * - participant:left (server) -> { userId } при отключении
 * - player:state (server) — синхронизация плеера
 * - chat:message (server) — новое сообщение чата
 * - playlist:updated (server) — плейлист изменился (клиенты перезапрашивают по REST)
 */
@WebSocketGateway({
  cors: { origin: true },
  transports: ['websocket'],
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rooms: RoomsService,
  ) {}

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
      const data = client.data as SocketData
      data.userId = userId
      data.joinedRoomIds = new Set()
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as SocketData
    const userId = data.userId
    const roomIds = data.joinedRoomIds
    if (userId && roomIds && roomIds.size > 0) {
      for (const roomId of roomIds) {
        this.server.to(`${ROOM_PREFIX}${roomId}`).emit('participant:left', { userId })
      }
    }
  }

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = (client.data as SocketData).userId
    if (!userId) return

    const dto = plainToInstance(RoomJoinDto, body as object)
    const errors = await validate(dto)
    if (errors.length > 0) {
      client.emit('room:error', { errors: errors.map((e) => e.constraints) })
      return
    }

    try {
      await this.rooms.ensureParticipant(dto.roomId, userId)
      client.join(`${ROOM_PREFIX}${dto.roomId}`)
      ;(client.data as SocketData).joinedRoomIds?.add(dto.roomId)
      const participants = await this.rooms.getParticipants(dto.roomId, userId)
      this.server.to(`${ROOM_PREFIX}${dto.roomId}`).emit('participant:list', participants)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      client.emit('room:error', { message: msg })
    }
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const data = client.data as SocketData
    const userId = data.userId
    if (!userId) return

    const dto = plainToInstance(RoomJoinDto, body as object)
    const errors = await validate(dto)
    if (errors.length > 0) return

    client.leave(`${ROOM_PREFIX}${dto.roomId}`)
    data.joinedRoomIds?.delete(dto.roomId)
    this.server.to(`${ROOM_PREFIX}${dto.roomId}`).emit('participant:left', { userId })
  }

  @SubscribeMessage('player:state')
  async handlePlayerState(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = (client.data as SocketData).userId
    if (!userId) return

    const dto = plainToInstance(PlayerStateSocketDto, body as object)
    const errors = await validate(dto)
    if (errors.length > 0) return

    try {
      await this.rooms.ensureParticipant(dto.roomId, userId)
      const payload = {
        userId,
        playing: dto.playing,
        currentTime: dto.currentTime,
        mediaId: dto.mediaId,
      }
      client.to(`${ROOM_PREFIX}${dto.roomId}`).emit('player:state', payload)
    } catch {
      // ignore
    }
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = (client.data as SocketData).userId
    if (!userId) return

    const dto = plainToInstance(RoomChatSendDto, body as object)
    const errors = await validate(dto)
    if (errors.length > 0) {
      client.emit('chat:error', { errors: errors.map((e) => e.constraints) })
      return
    }

    try {
      const message = await this.rooms.sendChatMessage(
        dto.roomId,
        userId,
        dto.text,
      )
      this.server.to(`${ROOM_PREFIX}${dto.roomId}`).emit('chat:message', message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      client.emit('chat:error', { message: msg })
    }
  }

  /** Вызвать после изменения плейлиста (add/reorder/remove), чтобы уведомить клиентов. */
  broadcastPlaylistUpdated(roomId: string): void {
    this.server.to(`${ROOM_PREFIX}${roomId}`).emit('playlist:updated')
  }
}
