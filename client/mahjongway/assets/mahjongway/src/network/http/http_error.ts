import { HttpRequestConfig } from './http_types';

/** 保留 HTTP 状态与响应体，供游戏层区分会话失效、状态冲突和网络异常。 */
export class HttpError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly data: unknown;
    readonly config: HttpRequestConfig;

    constructor(
        message: string,
        status: number,
        statusText: string,
        config: HttpRequestConfig,
        data?: unknown,
    ) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.statusText = statusText;
        this.config = config;
        this.data = data;
    }
}
