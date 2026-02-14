import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { AuthUser } from '../auth/auth.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UsersService, type PublicProfile } from './users.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<PublicProfile> {
    return this.users.getMe(user.id)
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicProfile> {
    return this.users.updateProfile(user.id, dto)
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (allowed.includes(file.mimetype)) cb(null, true)
        else cb(new BadRequestException('Invalid file type'), false)
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PublicProfile> {
    if (!file?.buffer) {
      throw new BadRequestException('Avatar file is required')
    }
    return this.users.setAvatar(user.id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
    })
  }

  @Get(':idOrUsername')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Param('idOrUsername') idOrUsername: string): Promise<PublicProfile> {
    return this.users.getByIdOrUsername(idOrUsername)
  }
}
