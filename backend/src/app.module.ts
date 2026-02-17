import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { S3Module } from './s3/s3.module'
import { StorageModule } from './storage/storage.module'
import { UsersModule } from './users/users.module'
import { ArchiveModule } from './archive/archive.module'
import { ChatsModule } from './chats/chats.module'
import { RoomsModule } from './rooms/rooms.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL')
        return {
          connection: url
            ? { url }
            : {
                host: config.get('REDIS_HOST', 'localhost'),
                port: config.get<number>('REDIS_PORT', 6379),
              },
        }
      },
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    S3Module,
    StorageModule,
    UsersModule,
    ArchiveModule,
    ChatsModule,
    RoomsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
