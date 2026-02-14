import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { Request, Response } from 'express'
import { AppModule } from './app.module'
import { TusService } from './archive/tus.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useWebSocketAdapter(new IoAdapter(app))
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  )
  app.enableCors({ origin: true, credentials: true })

  const httpAdapter = app.get(HttpAdapterHost).httpAdapter
  const expressApp = httpAdapter.getInstance() as ReturnType<
    typeof import('express')
  >
  const tusService = app.get(TusService)
  expressApp.use('/archive/upload', (req: Request, res: Response) => {
    req.url = req.originalUrl ?? req.url
    tusService.handle(req as unknown as import('node:http').IncomingMessage, res as unknown as import('node:http').ServerResponse)
  })

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
