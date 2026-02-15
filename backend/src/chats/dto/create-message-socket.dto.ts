import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator'
import { Type } from 'class-transformer'

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2 GB
const CHAT_ATTACHMENT_TYPES = ['IMAGE', 'VIDEO', 'AUDIO'] as const

export class ChatAttachmentKeyDto {
  @IsString()
  s3Key!: string

  @IsIn(CHAT_ATTACHMENT_TYPES)
  type!: (typeof CHAT_ATTACHMENT_TYPES)[number]

  @IsString()
  mimeType!: string

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  @Type(() => Number)
  size!: number

  @IsOptional()
  @IsString()
  thumbnailKey?: string
}

export class CreateMessageSocketDto {
  @IsString()
  chatId!: string

  @IsOptional()
  @IsString()
  @MaxLength(65535)
  text?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentKeyDto)
  attachmentKeys?: ChatAttachmentKeyDto[]
}
