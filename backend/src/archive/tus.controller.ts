import { All, Controller, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { TusService } from './tus.service'

/**
 * Обрабатывает все запросы к /tus/archive* и передаёт их в TusService (POST создание, PATCH/HEAD докачка).
 * Регистрация через контроллер нужна, чтобы Nest не отдавал 404 до нашего middleware.
 */
@Controller('tus/archive')
export class TusController {
  constructor(private readonly tusService: TusService) {}

  @All()
  @All(':id')
  handleTus(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): void {
    const path = (req as Request & { url?: string }).originalUrl ?? req.url ?? '/tus/archive'
    ;(req as Request & { url: string }).url = path
    this.tusService.handle(
      req as unknown as import('node:http').IncomingMessage,
      res as unknown as import('node:http').ServerResponse,
    )
  }
}
