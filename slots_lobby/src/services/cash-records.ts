import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { parseRechargeOrder } from './recharge';
export interface RecordRange { from: string; to: string }
export async function fetchCashRecords(range: RecordRange, cursor = '', signal?: AbortSignal) {
  const identity = await ensureSession();
  const params = new URLSearchParams({ uid: String(identity.uid), sid: identity.sid, from: range.from, to: range.to, limit: '20' });
  if (cursor) params.set('cursor', cursor);
  const data = await request('/api/recharge/order/list?' + params, { signal }, '存款记录加载失败，请重试');
  if (!isRecord(data) || !Array.isArray(data.items) || typeof data.nextCursor !== 'string')
    throw new Error('存款记录格式有误，请重试');
  const items = data.items.map((value: unknown) => parseRechargeOrder(value));
  if (new Set(items.map(item => item.orderId)).size !== items.length) throw new Error('存款记录含有重复订单');
  return { items, nextCursor: data.nextCursor };
}
