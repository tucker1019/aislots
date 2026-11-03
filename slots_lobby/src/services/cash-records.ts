import { t } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { parseRechargeOrder } from './recharge';
export interface RecordRange { from: string; to: string }
export async function fetchCashRecords(range: RecordRange, cursor = '', signal?: AbortSignal) {
  const identity = await ensureSession();
  const params = new URLSearchParams({ uid: String(identity.uid), sid: identity.sid, from: range.from, to: range.to, limit: '20' });
  if (cursor) params.set('cursor', cursor);
  const data = await request('/api/recharge/order/list?' + params, { signal }, t('copy.depositHistoryFailedToLoadPleaseRetry'));
  if (!isRecord(data) || !Array.isArray(data.items) || typeof data.nextCursor !== 'string')
    throw new Error(t('copy.invalidDepositHistoryPleaseRetry'));
  const items = data.items.map((value: unknown) => parseRechargeOrder(value));
  if (new Set(items.map(item => item.orderId)).size !== items.length) throw new Error(t('copy.duplicateDepositOrdersInResponse'));
  return { items, nextCursor: data.nextCursor };
}
