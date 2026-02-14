import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ArchiveController } from './archive.controller'
import { ArchiveService } from './archive.service'
import { TusService } from './tus.service'
import { ArchiveProcessor } from './archive.processor'
import { ArchiveProgressService } from './archive-progress.service'
import { ArchiveGateway } from './archive.gateway'
import { ARCHIVE_QUEUE_NAME } from './archive.processor'

@Module({
  imports: [
    BullModule.registerQueue({ name: ARCHIVE_QUEUE_NAME }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ArchiveController],
  providers: [
    ArchiveService,
    TusService,
    ArchiveProcessor,
    ArchiveProgressService,
    ArchiveGateway,
  ],
  exports: [ArchiveService, TusService],
})
export class ArchiveModule {}
