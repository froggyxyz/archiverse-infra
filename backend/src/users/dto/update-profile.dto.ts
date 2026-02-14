import { IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Username must be at least 2 characters' })
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username may contain only letters, numbers, underscore and hyphen',
  })
  username?: string

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  password?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  currentPassword?: string
}
