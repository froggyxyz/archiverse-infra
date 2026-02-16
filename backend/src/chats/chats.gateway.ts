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
import { ChatsService } from './chats.service'
import { CreateMessageSocketDto } from './dto/create-message-socket.dto'

const USER_ROOM_PREFIX = 'user:'

/**
 * События:
 * - message:send (client) -> { chatId, text?, attachmentKeys? }
 * - message:new (server) -> сообщение (в т.ч. получателю и отправителю)
 * - chat:unread (server) -> { chatId, unreadCount } получателям при новом сообщении
 * Подключение: auth.token / query.token (JWT). Сокет в комнате user:userId.
 */

@WebSocketGateway({
  cors: { origin: true },
  transports: ['websocket'],
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly chats: ChatsService,
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
      client.join(`${USER_ROOM_PREFIX}${userId}`)
      ;(client.data as { userId?: string }).userId = userId
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(): void {
    // no-op
  }

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = (client.data as { userId?: string }).userId
    if (!userId) return

    const dto = plainToInstance(CreateMessageSocketDto, body as object)
    const errors = await validate(dto)
    if (errors.length > 0) {
      client.emit('message:error', { errors: errors.map((e) => e.constraints) })
      return
    }

    try {
      const { message, recipientUserIds } = await this.chats.createMessage(
        dto.chatId,
        userId,
        dto.text,
        dto.attachmentKeys,
      )

      const room = `${USER_ROOM_PREFIX}${userId}`
      this.server.to(room).emit('message:new', message)

      for (const recipientId of recipientUserIds) {
        const recipientRoom = `${USER_ROOM_PREFIX}${recipientId}`
        this.server.to(recipientRoom).emit('message:new', message)
        const unreadCount = await this.chats.getUnreadCount(dto.chatId, recipientId)
        this.server.to(recipientRoom).emit('chat:unread', {
          chatId: dto.chatId,
          unreadCount,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      client.emit('message:error', { message: msg })
    }
  }
}
