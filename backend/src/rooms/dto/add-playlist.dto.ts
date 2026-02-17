import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator'

const MAX_ITEMS = 50

export class AddPlaylistDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one mediaId required' })
  @ArrayMaxSize(MAX_ITEMS)
  @IsString({ each: true })
  mediaIds!: string[]
}
