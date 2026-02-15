import {
  IsString,
  IsIn,
  IsMimeType,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { Type } from 'class-transformer'

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB
const CHAT_ATTACHMENT_TYPES = ['IMAGE', 'VIDEO', 'AUDIO'] as const
export type ChatAttachmentTypeDto = (typeof CHAT_ATTACHMENT_TYPES)[number]

export class UploadChatFileDto {
  @IsString()
  @MaxLength(255)
  filename!: string

  @IsMimeType()
  mimeType!: string

  @IsIn(CHAT_ATTACHMENT_TYPES)
  type!: ChatAttachmentTypeDto

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES)
  @Type(() => Number)
  size!: number
}
