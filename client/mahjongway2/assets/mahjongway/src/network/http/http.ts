import { HttpClient } from './http_client';

export { HttpClient } from './http_client';
export { HttpError } from './http_error';
export * from './http_types';

/** 默认实例，可在游戏启动时配置 baseURL / headers */
export const http = new HttpClient();
