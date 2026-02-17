import { IsString, MaxLength } from 'class-validator'

export class RoomChatSendDto {
  @IsString()
  roomId!: string

  @IsString()
  @MaxLength(65535)
  text!: string
}
