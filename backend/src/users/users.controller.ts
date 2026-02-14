import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
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
import { StorageService, type StorageInfo, type CheckQuotaResult } from '../storage/storage.service'
import { UsersService, type PublicProfile } from './users.service'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { CheckQuotaDto } from './dto/check-quota.dto'

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly storage: StorageService,
  ) {}

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

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  async removeAvatar(@CurrentUser() user: AuthUser): Promise<PublicProfile> {
    return this.users.removeAvatar(user.id)
  }

  @Get('me/storage')
  @UseGuards(JwtAuthGuard)
  async getStorage(@CurrentUser() user: AuthUser): Promise<StorageInfo> {
    return this.storage.getStorage(user.id)
  }

  @Post('me/storage/check')
  @UseGuards(JwtAuthGuard)
  async checkQuota(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckQuotaDto,
  ): Promise<CheckQuotaResult> {
    return this.storage.checkQuota(user.id, dto.size)
  }

  @Get(':idOrUsername')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Param('idOrUsername') idOrUsername: string): Promise<PublicProfile> {
    return this.users.getByIdOrUsername(idOrUsername)
  }
}
