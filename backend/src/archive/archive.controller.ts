import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.service'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ArchiveService, type MediaListItem, type MediaListResult } from './archive.service'
import { ListArchiveDto } from './dto/list-archive.dto'

@Controller('archive')
export class ArchiveController {
  constructor(private readonly archive: ArchiveService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser() user: AuthUser,
    @Query() dto: ListArchiveDto,
  ): Promise<MediaListResult> {
    return this.archive.listByUser(
      user.id,
      dto.page ?? 1,
      dto.limit ?? 20,
    )
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<MediaListItem> {
    return this.archive.getById(user.id, id)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.archive.deleteMedia(user.id, id)
  }
}
