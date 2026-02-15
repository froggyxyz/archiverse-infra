/**
 * Патч Request/Response до загрузки srvx (@tus/server).
 * srvx при загрузке делает globalThis._Request ??= globalThis.Request — поэтому патч должен быть первым.
 * Импортировать в main.ts самой первой строкой.
 */
const sanitizeHeader = (s: string) =>
  s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g, '').trim()

function sanitizeHeadersInit(
  h:
    | HeadersInit
    | undefined
    | { forEach?(cb: (v: string, k: string) => void): void; entries?(): Iterable<[string, string]> },
): Record<string, string> | undefined {
  if (h == null) return undefined
  const out: Record<string, string> = {}
  const add = (key: string, val: string) => {
    const k = sanitizeHeader(key)
    if (k) out[k] = sanitizeHeader(val)
  }
  if (typeof (h as Headers).forEach === 'function') {
    ;(h as Headers).forEach((val, key) => add(key, val))
  } else if (typeof (h as { entries?(): Iterable<[string, string]> }).entries === 'function') {
    for (const [key, val] of (h as Headers).entries()) add(key, val)
  } else if (Array.isArray(h)) {
    for (const [key, val] of h) add(String(key), String(val))
  } else {
    for (const [key, val] of Object.entries(h)) add(key, String(val ?? ''))
  }
  return Object.keys(out).length ? out : undefined
}

const NativeRequest = globalThis.Request
const NativeResponse = globalThis.Response

const PatchedRequest = class Request extends NativeRequest {
  constructor(
    input: RequestInfo | URL,
    init?: RequestInit & {
      headers?:
        | HeadersInit
        | { forEach?(cb: (v: string, k: string) => void): void; entries?(): Iterable<[string, string]> }
    },
  ) {
    const cleanHeaders = sanitizeHeadersInit(init?.headers as Parameters<typeof sanitizeHeadersInit>[0])
    const safeInit: RequestInit = { ...init, headers: cleanHeaders ?? init?.headers }
    super(input, safeInit)
  }
}
globalThis.Request = PatchedRequest as unknown as typeof NativeRequest

const PatchedResponse = class Response extends NativeResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    const cleanHeaders = sanitizeHeadersInit(init?.headers)
    const safeInit: ResponseInit = { ...init, headers: cleanHeaders ?? init?.headers }
    super(body, safeInit)
  }
}
Object.defineProperty(PatchedResponse, 'error', { value: NativeResponse.error, configurable: true })
Object.defineProperty(PatchedResponse, 'redirect', { value: NativeResponse.redirect, configurable: true })
Object.defineProperty(PatchedResponse, 'json', { value: NativeResponse.json, configurable: true })
globalThis.Response = PatchedResponse as unknown as typeof NativeResponse
