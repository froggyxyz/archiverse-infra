import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RoomsController } from './rooms.controller'
import { RoomsService } from './rooms.service'
import { RoomsGateway } from './rooms.gateway'
import { ArchiveModule } from '../archive/archive.module'
import { S3Module } from '../s3/s3.module'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', '15m') },
      }),
      inject: [ConfigService],
    }),
    ArchiveModule,
    S3Module,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway],
  exports: [RoomsService],
})
export class RoomsModule {}
