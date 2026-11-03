import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { t } from '../i18n';
export interface WalletAccount { channel: string; account: string; name: string; bound: boolean }
export function parseWalletAccount(value: unknown): WalletAccount {
  if (!isRecord(value) || typeof value.channel !== 'string' || !value.channel ||
    typeof value.account !== 'string' || typeof value.name !== 'string' || typeof value.bound !== 'boolean' ||
    (value.bound && (!value.account || !value.name))) throw new Error(t('wallet.invalidResponse'));
  return { channel: value.channel, account: value.account, name: value.name, bound: value.bound };
}
export async function loadWalletAccounts(signal?: AbortSignal): Promise<WalletAccount[]> {
  const identity = await ensureSession();
  const data = await request('/api/user/wallet/accounts', { method: 'POST', signal,
    body: JSON.stringify({ uid: identity.uid, sid: identity.sid }) }, t('wallet.loadFailed'));
  if (!isRecord(data) || !Array.isArray(data.channels)) throw new Error(t('wallet.invalidResponse'));
  const result = data.channels.map(parseWalletAccount);
  if (new Set(result.map(row => row.channel)).size !== result.length) throw new Error(t('wallet.invalidResponse'));
  return result;
}
export async function saveWalletAccount(value: Pick<WalletAccount, 'channel' | 'account' | 'name'>): Promise<WalletAccount> {
  const identity = await ensureSession();
  const data = await request('/api/user/wallet/account/save', { method: 'POST',
    body: JSON.stringify({ uid: identity.uid, sid: identity.sid, ...value }) }, t('wallet.saveFailed'));
  const result = parseWalletAccount(data);
  if (result.channel !== value.channel || !result.bound) throw new Error(t('wallet.invalidResponse'));
  return result;
}
