import './patch-headers'
import { NestFactory } from '@nestjs/core'
import { HttpAdapterHost } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { Request, Response } from 'express'
import { AppModule } from './app.module'
import { TusService } from './archive/tus.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const httpAdapter = app.get(HttpAdapterHost).httpAdapter
  const expressApp = httpAdapter.getInstance() as import('express').Express
  const tusService = app.get(TusService)

  const TUS_DEBUG = process.env.TUS_DEBUG === '1'
  // Node HTTP rejects control chars in headers; allow \t (0x09), strip the rest
  const sanitizeHeader = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g, '').trim()
  const hasBadChars = (s: string) => /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s)
  const repr = (v: string) => JSON.stringify(v.slice(0, 80)) + (v.length > 80 ? '...' : '')

  // TUS первым в стеке Express: иначе Nest отдаёт 404 на POST /tus/archive
  expressApp.use('/tus/archive', async (req: Request, res: Response) => {
    if (TUS_DEBUG) {
      console.log('[TUS] request:', req.method, req.url, 'originalUrl:', req.originalUrl)
    }
    const pathOnly = (req.originalUrl ?? req.url ?? '/tus/archive').split('?')[0]
    const nodeReq = req as import('node:http').IncomingMessage & {
      method?: string
      url?: string
      headers?: Record<string, string | string[] | undefined>
    }
    nodeReq.method = (req.method ?? 'GET').toUpperCase()
    nodeReq.url = pathOnly
    const raw = nodeReq.headers as Record<string, string | string[] | undefined> | undefined
    if (raw) {
      if (TUS_DEBUG) {
        for (const [k, v] of Object.entries(raw)) {
          const val = typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : String(v)
          if (k.toLowerCase() === 'content-type') {
            console.log('[TUS] content-type raw:', repr(val), 'len=', val.length, 'codes:', [...val].map((c) => c.charCodeAt(0)))
          }
          if (hasBadChars(k) || hasBadChars(val)) {
            console.log('[TUS] RAW header BAD chars:', k, '=>', repr(val), 'codes:', [...val].map((c) => c.charCodeAt(0)))
          }
        }
      }
      const out: Record<string, string | string[]> = {}
      for (const [k, v] of Object.entries(raw)) {
        const key = sanitizeHeader(k)
        if (!key) continue
        if (typeof v === 'string') out[key] = sanitizeHeader(v)
        else if (Array.isArray(v)) out[key] = v.map((s) => (typeof s === 'string' ? sanitizeHeader(s) : s))
        else if (v != null) out[key] = v as string | string[]
      }
      Object.defineProperty(nodeReq, 'headers', { value: out, writable: true, configurable: true })
      const rawHeaders = (nodeReq as import('node:http').IncomingMessage & { rawHeaders?: string[] }).rawHeaders
      if (Array.isArray(rawHeaders)) {
        const cleanRaw: string[] = []
        for (let i = 0; i < rawHeaders.length; i += 2) {
          const k = rawHeaders[i]
          const v = rawHeaders[i + 1]
          if (k != null && v != null) {
            const sk = sanitizeHeader(String(k))
            if (sk) cleanRaw.push(sk, sanitizeHeader(String(v)))
          }
        }
        Object.defineProperty(nodeReq, 'rawHeaders', { value: cleanRaw, writable: true, configurable: true })
      }
    }
    const nodeRes = res as import('node:http').ServerResponse
    const origWriteHead = nodeRes.writeHead.bind(nodeRes)
    const writeHeadWrapper = function (
      statusCode: number,
      statusMessageOrHeaders?: string | import('node:http').OutgoingHttpHeaders | import('node:http').OutgoingHttpHeader[],
      maybeHeaders?: import('node:http').OutgoingHttpHeaders | import('node:http').OutgoingHttpHeader[],
    ) {
      let statusMessage: string | undefined
      let headers: import('node:http').OutgoingHttpHeaders | import('node:http').OutgoingHttpHeader[] | undefined
      if (typeof statusMessageOrHeaders === 'string') {
        statusMessage = sanitizeHeader(statusMessageOrHeaders)
        headers = maybeHeaders
      } else {
        headers = statusMessageOrHeaders
      }
      if (TUS_DEBUG && headers) {
        if (Array.isArray(headers)) {
          for (let i = 0; i < headers.length; i += 2) {
            const k = headers[i]
            const v = headers[i + 1]
            const vs = String(v ?? '')
            if (hasBadChars(String(k)) || hasBadChars(vs)) {
              console.log('[TUS] writeHead IN array BAD:', repr(String(k)), '=>', repr(vs), 'codes:', [...vs].map((c) => c.charCodeAt(0)))
            }
          }
        } else {
          for (const [k, v] of Object.entries(headers)) {
            const vs = typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : String(v ?? '')
            if (hasBadChars(k) || hasBadChars(vs)) {
              console.log('[TUS] writeHead IN object BAD:', repr(k), '=>', repr(vs))
            }
          }
        }
      }
      if (headers) {
        if (Array.isArray(headers)) {
          // srvx передаёт плоский массив [k,v,k,v,...]. on-headers (morgan и др.) ожидает массив пар [[k,v],[k,v]]
          // или объект. Передаём объект, чтобы избежать ERR_HTTP_INVALID_HEADER_VALUE / "undefined".
          const flat = headers as (string | number)[]
          const cleanObj: import('node:http').OutgoingHttpHeaders = {}
          for (let i = 0; i < flat.length; i += 2) {
            const k = flat[i]
            const v = flat[i + 1]
            if (k == null || v == null || String(v) === 'undefined') continue
            const key = sanitizeHeader(String(k))
            if (!key) continue
            if (typeof v === 'number') cleanObj[key] = v
            else cleanObj[key] = sanitizeHeader(String(v))
          }
          if (TUS_DEBUG) {
            console.log('[TUS] writeHead called status=%s object keys=%s', statusCode, Object.keys(cleanObj).join(','))
          }
          try {
            if (typeof statusMessage === 'string') return origWriteHead(statusCode, statusMessage, cleanObj)
            return origWriteHead(statusCode, cleanObj)
          } catch (err) {
            console.error('[TUS] writeHead FAILED (array→object)', statusCode, Object.keys(cleanObj), err)
            throw err
          }
        }
        const clean: import('node:http').OutgoingHttpHeaders = {}
        for (const [k, v] of Object.entries(headers)) {
          const key = sanitizeHeader(k)
          if (!key) continue
          if (typeof v === 'string') clean[key] = sanitizeHeader(v)
          else if (Array.isArray(v)) clean[key] = v.map((s) => (typeof s === 'string' ? sanitizeHeader(s) : s))
          else if (typeof v === 'number') clean[key] = v
          else if (v != null) clean[key] = v
        }
        if (TUS_DEBUG) {
          console.log('[TUS] writeHead called status=%s object keys=%s', statusCode, Object.keys(clean).join(','))
        }
        try {
          if (typeof statusMessage === 'string') return origWriteHead(statusCode, statusMessage, clean)
          return origWriteHead(statusCode, clean)
        } catch (err) {
          console.error('[TUS] writeHead FAILED (object)', statusCode, clean, err)
          throw err
        }
      }
      if (typeof statusMessage === 'string') return origWriteHead(statusCode, statusMessage)
      return origWriteHead(statusCode)
    }
    nodeRes.writeHead = writeHeadWrapper as typeof nodeRes.writeHead
    // Логируем тело ответа при 500 (сообщение об ошибке от TUS)
    let logged500Body = false
    const maybeLog500Body = (chunk: unknown) => {
      if (!logged500Body && nodeRes.statusCode === 500 && chunk != null) {
        logged500Body = true
        const s = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
            .slice(0, 500)
        console.error('[TUS] response 500 body:', s)
      }
    }
    const origWrite = nodeRes.write.bind(nodeRes)
    nodeRes.write = function (chunk: unknown, ...args: unknown[]) {
      maybeLog500Body(chunk)
      return origWrite(chunk as never, ...(args as [never]))
    }
    const origEnd = nodeRes.end.bind(nodeRes)
    nodeRes.end = function (chunk?: unknown, ...args: unknown[]) {
      maybeLog500Body(chunk)
      return origEnd(chunk as never, ...(args as [never]))
    }
    const run = async () => {
      if (TUS_DEBUG) {
        const wrappedReq = new Proxy(nodeReq, {
          get(target, p) {
            const v = (target as unknown as Record<string | symbol, unknown>)[p]
            if (p === 'method' || p === 'url') console.log('[TUS] srvx read req.%s =>', p, v)
            return v
          },
        })
        return tusService.handle(
          wrappedReq as unknown as import('node:http').IncomingMessage,
          nodeRes,
        )
      }
      return tusService.handle(nodeReq as unknown as import('node:http').IncomingMessage, nodeRes)
    }
    try {
      await run()
    } catch (err) {
      console.error('[TUS] handle() threw:', err)
      console.error('[TUS] stack:', err instanceof Error ? err.stack : 'no stack')
      if (!res.headersSent) {
        res.statusCode = 500
        res.end(
          typeof (err as Error).message === 'string'
            ? (err as Error).message
            : 'Internal Server Error',
        )
      }
      throw err
    }
  })

  app.useWebSocketAdapter(new IoAdapter(app))
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  )
  app.enableCors({ origin: true, credentials: true })

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
