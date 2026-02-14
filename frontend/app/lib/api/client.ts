import type { ApiClient, ApiClientHooks, ApiError, ApiRequestOptions } from '~/types/api'

export const createApiClient = (baseUrl: string, hooks?: ApiClientHooks): ApiClient => {
  let refreshPromise: Promise<boolean> | null = null

  const fetcher = $fetch.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    onRequest({ options }) {
      const token = hooks?.getAccessToken?.()
      if (token) {
        options.headers = new Headers(options.headers)
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },
    onResponseError({ response }) {
      const error: ApiError = {
        statusCode: response.status,
        statusMessage: response.statusText,
        message: (response._data as { message?: string })?.message ?? response.statusText,
        data: response._data,
      }
      throw createError(error)
    },
  })

  const request = async <T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Promise<T> => {
    const path = url.startsWith('/') ? url : `/${url}`
    const headers = { ...options?.headers }
    const query = options?.params

    const doRequest = () =>
      fetcher<T>(path, {
        method,
        ...(body !== undefined && { body }),
        ...(Object.keys(headers).length > 0 && { headers }),
        ...(query && { query }),
      })

    try {
      return await doRequest()
    } catch (e) {
      const err = e as { statusCode?: number }
      if (err.statusCode === 401 && hooks?.onUnauthorized) {
        if (!refreshPromise) {
          refreshPromise = hooks.onUnauthorized().finally(() => {
            refreshPromise = null
          })
        }
        const refreshed = await refreshPromise
        if (refreshed) return doRequest()
      }
      throw e
    }
  }

  return {
    get: <T>(url: string, options?: ApiRequestOptions) =>
      request<T>('GET', url, undefined, options),
    post: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('POST', url, body, options),
    put: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('PUT', url, body, options),
    patch: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('PATCH', url, body, options),
    delete: <T>(url: string, options?: ApiRequestOptions) =>
      request<T>('DELETE', url, undefined, options),
  }
}
