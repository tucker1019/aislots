import { HttpError } from './http_error';
import {
    HttpClientConfig,
    HttpErrorInterceptor,
    HttpMethod,
    HttpParams,
    HttpRequestConfig,
    HttpRequestInterceptor,
    HttpResponse,
    HttpResponseInterceptor,
} from './http_types';

const DEFAULT_TIMEOUT = 15000;

function buildQuery(params?: HttpParams): string {
    if (!params) {
        return '';
    }
    const parts: string[] = [];
    for (const key in params) {
        const value = params[key];
        if (value === undefined || value === null) {
            continue;
        }
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function joinURL(baseURL: string, url: string): string {
    if (!baseURL) {
        return url;
    }
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
}

function parseResponseHeaders(raw: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = raw.trim().split(/[\r\n]+/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const idx = line.indexOf(':');
        if (idx <= 0) {
            continue;
        }
        const key = line.slice(0, idx).trim().toLowerCase();
        headers[key] = line.slice(idx + 1).trim();
    }
    return headers;
}

function parseBody<T>(xhr: XMLHttpRequest, responseType?: XMLHttpRequestResponseType): T {
    if (responseType === 'json' || responseType === undefined || responseType === '') {
        const text = xhr.responseText;
        if (!text) {
            return null as T;
        }
        try {
            return JSON.parse(text) as T;
        } catch {
            return text as T;
        }
    }
    return xhr.response as T;
}

/** 通用 XHR 封装：负责超时、响应解析及拦截器，不负责下注幂等或游戏流程。 */
export class HttpClient {
    private baseURL = '';
    private timeout = DEFAULT_TIMEOUT;
    private defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    private requestInterceptors: HttpRequestInterceptor[] = [];
    private responseInterceptors: HttpResponseInterceptor[] = [];
    private errorInterceptors: HttpErrorInterceptor[] = [];

    constructor(config?: HttpClientConfig) {
        if (config) {
            this.setConfig(config);
        }
    }

    setConfig(config: HttpClientConfig) {
        if (config.baseURL !== undefined) {
            this.baseURL = config.baseURL;
        }
        if (config.timeout !== undefined) {
            this.timeout = config.timeout;
        }
        if (config.headers) {
            this.defaultHeaders = { ...this.defaultHeaders, ...config.headers };
        }
    }

    useRequest(interceptor: HttpRequestInterceptor) {
        this.requestInterceptors.push(interceptor);
        return this;
    }

    useResponse(interceptor: HttpResponseInterceptor) {
        this.responseInterceptors.push(interceptor);
        return this;
    }

    useError(interceptor: HttpErrorInterceptor) {
        this.errorInterceptors.push(interceptor);
        return this;
    }

    get<T = unknown>(url: string, config?: Omit<HttpRequestConfig, 'url' | 'method'>) {
        return this.request<T>({ ...config, url, method: 'GET' });
    }

    post<T = unknown>(
        url: string,
        data?: unknown,
        config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>,
    ) {
        return this.request<T>({ ...config, url, method: 'POST', data });
    }

    put<T = unknown>(
        url: string,
        data?: unknown,
        config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>,
    ) {
        return this.request<T>({ ...config, url, method: 'PUT', data });
    }

    delete<T = unknown>(url: string, config?: Omit<HttpRequestConfig, 'url' | 'method'>) {
        return this.request<T>({ ...config, url, method: 'DELETE' });
    }

    async request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
        let finalConfig = { ...config };
        for (const interceptor of this.requestInterceptors) {
            finalConfig = await interceptor(finalConfig);
        }
        try {
            let response = await this.send<T>(finalConfig);
            for (const interceptor of this.responseInterceptors) {
                response = await interceptor(response);
            }
            return response;
        } catch (error) {
            const httpError =
                error instanceof HttpError
                    ? error
                    : new HttpError(
                          error instanceof Error ? error.message : 'Network error',
                          0,
                          '',
                          finalConfig,
                      );
            for (const interceptor of this.errorInterceptors) {
                interceptor(httpError);
            }
            throw httpError;
        }
    }

    private send<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
        const method: HttpMethod = config.method || 'GET';
        const timeout = config.timeout ?? this.timeout;
        const responseType = config.responseType;
        const url = joinURL(this.baseURL, config.url) + buildQuery(config.params);
        const headers = { ...this.defaultHeaders, ...config.headers };
        const hasBody = config.data !== undefined && config.data !== null;
        if ((method === 'GET' || method === 'DELETE') && !hasBody) {
            delete headers['Content-Type'];
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            xhr.timeout = timeout;
            if (responseType) {
                xhr.responseType = responseType;
            }

            for (const key in headers) {
                if (headers[key] !== undefined) {
                    xhr.setRequestHeader(key, headers[key]);
                }
            }

            xhr.onload = () => {
                const resHeaders = parseResponseHeaders(xhr.getAllResponseHeaders());
                const response: HttpResponse<T> = {
                    data: parseBody<T>(xhr, responseType),
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: resHeaders,
                    config,
                };
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(response);
                } else {
                    reject(
                        new HttpError(
                            `Request failed: ${xhr.status} ${xhr.statusText}`,
                            xhr.status,
                            xhr.statusText,
                            config,
                            response.data,
                        ),
                    );
                }
            };

            xhr.onerror = () => {
                reject(new HttpError('Network error', 0, '', config));
            };

            xhr.ontimeout = () => {
                reject(new HttpError(`Request timeout (${timeout}ms)`, 0, '', config));
            };

            const body = this.serializeBody(config.data, headers['Content-Type']);
            xhr.send(body);
        });
    }

    private serializeBody(data: unknown, contentType?: string): string | null {
        if (data === undefined || data === null) {
            return null;
        }
        if (typeof data === 'string') {
            return data;
        }
        if (contentType && contentType.indexOf('application/json') >= 0) {
            return JSON.stringify(data);
        }
        return String(data);
    }
}
