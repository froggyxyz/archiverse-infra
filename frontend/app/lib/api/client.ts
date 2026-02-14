import type { ApiClient, ApiError, ApiRequestOptions } from '~/types/api'

export const createApiClient = (baseUrl: string): ApiClient => {
  const fetcher = $fetch.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
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

    return fetcher<T>(path, {
      method,
      ...(body !== undefined && { body }),
      ...(Object.keys(headers).length > 0 && { headers }),
      ...(query && { query }),
    })
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
