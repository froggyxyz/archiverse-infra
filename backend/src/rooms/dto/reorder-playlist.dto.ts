import { IsArray, IsString, ArrayMinSize } from 'class-validator'

export class ReorderPlaylistDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  itemIds!: string[]
}
