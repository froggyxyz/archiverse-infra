import { IsString } from 'class-validator'

export class RoomJoinDto {
  @IsString()
  roomId!: string
}
