import type { HttpError } from './http_error';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type HttpParams = Record<string, string | number | boolean | undefined | null>;

/** HTTP 传输层参数；游戏会话和 requestId 由 GameApi 管理。 */
export interface HttpRequestConfig {
    url: string;
    method?: HttpMethod;
    params?: HttpParams;
    data?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
    responseType?: XMLHttpRequestResponseType;
}

export interface HttpResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: HttpRequestConfig;
}

export interface HttpClientConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
}

export type HttpRequestInterceptor = (
    config: HttpRequestConfig,
) => HttpRequestConfig | Promise<HttpRequestConfig>;

export type HttpResponseInterceptor = <T>(
    response: HttpResponse<T>,
) => HttpResponse<T> | Promise<HttpResponse<T>>;

export type HttpErrorInterceptor = (error: HttpError) => unknown;
