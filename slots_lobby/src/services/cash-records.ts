import { t } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { parseWithdrawal } from './withdrawal';
import { parseRechargeOrder } from './recharge';
export interface RecordRange { from: string; to: string }
export async function fetchCashRecords(range: RecordRange, cursor = '', signal?: AbortSignal, kind='all') {
  const identity = await ensureSession();
  const data = await request('/api/user/cash/orders', {method:'POST',signal,body:JSON.stringify({uid:identity.uid,sid:identity.sid,from:range.from,to:range.to,cursor,kind})},t('copy.depositHistoryFailedToLoadPleaseRetry'));
  if (!isRecord(data) || !Array.isArray(data.items) || typeof data.nextCursor !== 'string')
    throw new Error(t('copy.invalidDepositHistoryPleaseRetry'));
  const items = data.items.map((value: unknown) => isRecord(value)&&value.kind==='withdrawal'?parseWithdrawal(value):parseRechargeOrder(value));
  if (new Set(items.map(item => item.orderId)).size !== items.length) throw new Error(t('copy.duplicateDepositOrdersInResponse'));
  return { items, nextCursor: data.nextCursor };
}
