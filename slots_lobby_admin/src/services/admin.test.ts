import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseOrder, parseSession, reviewOrder } from './admin';
import { amount, json } from './schema';
import { money } from './format';
import { ApiError, request } from './client';
afterEach(() => vi.restoreAllMocks());
describe('admin contract guards', () => {
 it('rejects player session and unsupported role', () => {
  expect(() => parseSession({ uid: '1', sid: 'player' })).toThrow();
  expect(() => parseSession({ username: 'user', role: 'root' })).toThrow();
  expect(parseSession({ username: 'finance', role: 'finance' }).role).toBe('finance');
 });
 it('rejects non-integer money rather than losing precision', () => {
  expect(() => amount(100)).toThrow(); expect(() => amount('1.25')).toThrow();
  expect(money('900719925474099312345')).toBe('9,007,199,254,740,993,123.45');
  expect(money('-5')).toBe('-0.05');
 });
 it('rejects malformed orders and non-JSON documents', () => {
  expect(() => parseOrder({ kind: 'payment' })).toThrow();
  expect(() => json({ bad: Number.POSITIVE_INFINITY })).toThrow();
 });
});
describe('financial review transport', () => {
 it('uses cookie, CSRF marker, original order and stable idempotency key', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ code: 'OK', data: { orderId: 'original-order', status: 'approved' } }), { status: 200 }));
  const body = { kind: 'withdrawal' as const, orderId: 'original-order', decision: 'approve' as const, reason: '已核实', requestId: 'retry-same-key' };
  await reviewOrder(body); await reviewOrder(body);
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const call of fetcher.mock.calls) {
   expect(call[0]).toBe('/admin/api/orders/review');
   expect(call[1]).toMatchObject({ method: 'POST', credentials: 'include', headers: { 'X-Admin-Request': '1' }, body: JSON.stringify(body) });
  }
 });
 it('surfaces conflict without automatically retrying a financial write', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'CONFLICT', message: '订单已处理' }), { status: 409 }));
  await expect(reviewOrder({ kind: 'deposit', orderId: '1', decision: 'approve', reason: '核实', requestId: '1' })).rejects.toMatchObject({ status: 409, message: '订单已处理' });
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('does not invalidate session during initial unauthenticated session check', async () => {
  const event = vi.fn(); window.addEventListener('admin-session-expired', event);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: '请登录' }), { status: 401 }));
  await expect(request('/me', json)).rejects.toBeInstanceOf(ApiError);
  expect(event).not.toHaveBeenCalled(); window.removeEventListener('admin-session-expired', event);
 });
});
