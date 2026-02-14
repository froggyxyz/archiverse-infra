import { IsNumber, Min } from 'class-validator'

export class CheckQuotaDto {
  @IsNumber()
  @Min(0)
  size: number
}
