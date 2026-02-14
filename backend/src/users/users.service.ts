import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import * as argon2 from 'argon2'
import { PrismaService } from './../prisma/prisma.service'
import { S3Service } from '../s3/s3.service'
import type { UpdateProfileDto } from './dto/update-profile.dto'

const CUID_LENGTH = 25
const CUID_PREFIX = 'c'

export type PublicProfile = {
  id: string
  username: string
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getMe(userId: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, createdAt: true, updatedAt: true },
    })
    if (!user) throw new NotFoundException('User not found')
    return this.withPresignedAvatar(user)
  }

  async getByIdOrUsername(idOrUsername: string): Promise<PublicProfile> {
    const isId = this.looksLikeCuid(idOrUsername)
    const user = await this.prisma.user.findFirst({
      where: isId ? { id: idOrUsername } : { username: idOrUsername },
      select: { id: true, username: true, avatarUrl: true, createdAt: true, updatedAt: true },
    })
    if (!user) throw new NotFoundException('User not found')
    return this.withPresignedAvatar(user)
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicProfile> {
    if (dto.username !== undefined) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      })
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username already taken')
      }
    }
    if (dto.password !== undefined) {
      if (!dto.currentPassword) {
        throw new BadRequestException('currentPassword is required to set a new password')
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      })
      if (!user || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
        throw new BadRequestException('Current password is incorrect')
      }
    }
    const updates: { username?: string; passwordHash?: string } = {}
    if (dto.username !== undefined) updates.username = dto.username
    if (dto.password !== undefined) {
      updates.passwordHash = await argon2.hash(dto.password)
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, username: true, avatarUrl: true, createdAt: true, updatedAt: true },
    })
    return this.withPresignedAvatar(user)
  }

  async setAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<PublicProfile> {
    const avatarUrl = await this.s3.uploadAvatar(userId, file)
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, username: true, avatarUrl: true, createdAt: true, updatedAt: true },
    })
    return this.withPresignedAvatar(user)
  }

  async removeAvatar(userId: string): Promise<PublicProfile> {
    await this.s3.deleteUserAvatars(userId)
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: { id: true, username: true, avatarUrl: true, createdAt: true, updatedAt: true },
    })
    return this.withPresignedAvatar(user)
  }

  private async withPresignedAvatar(profile: PublicProfile): Promise<PublicProfile> {
    const avatarUrl = await this.s3.getPresignedAvatarUrl(profile.avatarUrl)
    return { ...profile, avatarUrl }
  }

  private looksLikeCuid(value: string): boolean {
    return (
      value.length === CUID_LENGTH &&
      value.startsWith(CUID_PREFIX) &&
      /^[a-z0-9]+$/i.test(value)
    )
  }
}
