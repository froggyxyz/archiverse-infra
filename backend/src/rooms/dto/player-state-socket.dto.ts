import { IsString, IsOptional, IsBoolean, IsNumber, ValidateIf } from 'class-validator'

export class PlayerStateSocketDto {
  @IsString()
  roomId!: string

  @IsOptional()
  @IsBoolean()
  playing?: boolean

  @IsOptional()
  @IsNumber()
  currentTime?: number

  @ValidateIf((_o, v) => v != null)
  @IsString()
  mediaId?: string | null
}
