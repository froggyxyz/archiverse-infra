import { Injectable, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024 // 10 GB

export type StorageInfo = {
  usedBytes: number
  limitBytes: number
}

export type CheckQuotaResult = {
  allowed: boolean
  remainingBytes: number
}

@Injectable()
export class StorageService {
  constructor(private readonly prisma: PrismaService) {}

  async getStorage(userId: string): Promise<StorageInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsed: true, storageLimit: true },
    })
    if (!user) throw new ForbiddenException()
    return {
      usedBytes: Number(user.storageUsed),
      limitBytes: Number(user.storageLimit ?? BigInt(DEFAULT_STORAGE_LIMIT)),
    }
  }

  async checkQuota(userId: string, sizeBytes: number): Promise<CheckQuotaResult> {
    const { usedBytes, limitBytes } = await this.getStorage(userId)
    const remainingBytes = Math.max(0, limitBytes - usedBytes)
    const allowed = sizeBytes <= remainingBytes
    return { allowed, remainingBytes }
  }

  async addUsage(userId: string, sizeBytes: number): Promise<void> {
    if (sizeBytes <= 0) return
    await this.prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { increment: BigInt(sizeBytes) } },
    })
  }

  async subtractUsage(userId: string, sizeBytes: number): Promise<void> {
    if (sizeBytes <= 0) return
    const { usedBytes } = await this.getStorage(userId)
    const newUsed = Math.max(0, usedBytes - sizeBytes)
    await this.prisma.user.update({
      where: { id: userId },
      data: { storageUsed: BigInt(newUsed) },
    })
  }
}
