import { IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class GetChatMessagesDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 50

  @IsOptional()
  cursor?: string // message id для пагинации «назад»
}
