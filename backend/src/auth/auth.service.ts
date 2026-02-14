import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'

export type AuthUser = { id: string; username: string }

export type TokenPair = { accessToken: string; refreshToken: string }

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: AuthUser } & TokenPair> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    })
    if (existing) {
      throw new ConflictException('Username already taken')
    }
    const passwordHash = await argon2.hash(dto.password)
    const user = await this.prisma.user.create({
      data: { username: dto.username, passwordHash },
    })
    return this.issueTokensAndUser(user)
  }

  async login(dto: LoginDto): Promise<{ user: AuthUser } & TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    })
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid username or password')
    }
    return this.issueTokensAndUser(user)
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(refreshToken)
    if (!payload?.sub || !payload?.tokenId) {
      throw new UnauthorizedException('Invalid refresh token')
    }
    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: true },
    })
    if (
      !record ||
      record.userId !== payload.sub ||
      record.expiresAt < new Date()
    ) {
      if (record) {
        await this.prisma.refreshToken.delete({ where: { id: record.id } })
      }
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
    await this.prisma.refreshToken.delete({ where: { id: record.id } })
    return this.issueTokensAndUser(record.user)
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } })
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    })
    if (!user) {
      throw new UnauthorizedException('User not found')
    }
    return user
  }

  private async issueTokensAndUser(
    user: { id: string; username: string },
  ): Promise<{ user: AuthUser } & TokenPair> {
    const pair = await this.createTokenPair(user.id, user.username)
    return {
      user: { id: user.id, username: user.username },
      ...pair,
    }
  }

  private async createTokenPair(
    userId: string,
    username: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: userId, username },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
      },
    )
    const tokenId = randomUUID()
    const refreshExpiresIn = this.config.get('JWT_REFRESH_TTL', '7d')
    const refreshExpiresAt = this.parseTtlToDate(refreshExpiresIn)
    const refreshToken = this.jwt.sign(
      { sub: userId, tokenId },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    )
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        expiresAt: refreshExpiresAt,
      },
    })
    return { accessToken, refreshToken }
  }

  private verifyRefreshToken(token: string): { sub?: string; tokenId?: string } | null {
    try {
      return this.jwt.verify(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      }) as { sub: string; tokenId: string }
    } catch {
      return null
    }
  }

  private parseTtlToDate(ttl: string): Date {
    const match = ttl.match(/^(\d+)([smhd])$/)
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const value = Number(match[1])
    const unit = match[2]
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    }
    return new Date(Date.now() + value * (multipliers[unit] ?? 0))
  }
}
