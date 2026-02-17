import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator'

export class PlayerStateSocketDto {
  @IsString()
  roomId!: string

  @IsOptional()
  @IsBoolean()
  playing?: boolean

  @IsOptional()
  @IsNumber()
  currentTime?: number

  @IsOptional()
  @IsString()
  mediaId?: string
}
