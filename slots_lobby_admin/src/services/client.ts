import { object, string } from './schema';
export class ApiError extends Error {
 constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function request<T>(path: string, parse: (data: unknown) => T, body?: unknown): Promise<T> {
 const response = await fetch(`/admin/api${path}`, {
  method: body === undefined ? 'GET' : 'POST', credentials: 'include',
  headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
 });
 let payload: unknown;
 try { payload = await response.json(); } catch { throw new ApiError(response.status, 'INVALID_RESPONSE', '服务响应异常，请稍后重试'); }
 const envelope = object(payload);
 if (!response.ok || envelope.code !== 'OK') {
  if (response.status === 401 && path !== '/me' && path !== '/login') window.dispatchEvent(new Event('admin-session-expired'));
  throw new ApiError(response.status, string(envelope.code), typeof envelope.message === 'string' ? envelope.message : '请求失败');
 }
 return parse(envelope.data);
}
export function params(values: Record<string, string | number | undefined>): string {
 const query = new URLSearchParams();
 for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') query.set(key, String(value));
 return `?${query}`;
}
