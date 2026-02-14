export type ApiError = {
  statusCode: number
  statusMessage: string
  message: string
  data?: unknown
}

export type ApiResponse<T = unknown> = {
  data: T
  status: number
}

export type ApiRequestOptions = {
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean>
}

export type ApiClient = {
  get: <T>(url: string, options?: ApiRequestOptions) => Promise<T>
  post: <T>(url: string, body?: unknown, options?: ApiRequestOptions) => Promise<T>
  postFormData: <T>(url: string, formData: FormData, options?: ApiRequestOptions) => Promise<T>
  put: <T>(url: string, body?: unknown, options?: ApiRequestOptions) => Promise<T>
  patch: <T>(url: string, body?: unknown, options?: ApiRequestOptions) => Promise<T>
  delete: <T>(url: string, options?: ApiRequestOptions) => Promise<T>
}

export type ApiClientHooks = {
  getAccessToken?: () => string | null
  onUnauthorized?: () => Promise<boolean>
}
