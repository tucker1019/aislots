import { t } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export interface BetRecord { betId: string; gameId: string; gameName: string; provider: string; createdAt: string; betAmount: number; validBet: number; profit: number }
export interface BetRecordPage { items: BetRecord[]; count: number; betAmount: number; profit: number; hasMore: boolean; currency: string; providers: string[] }
export function parseBetRecords(data: unknown): BetRecordPage {
  if (!isRecord(data) || !Array.isArray(data.items) || !Number.isSafeInteger(data.count) || Number(data.count) < 0 || !Number.isSafeInteger(data.betAmount) || Number(data.betAmount) < 0 || !Number.isSafeInteger(data.profit) || typeof data.hasMore !== 'boolean' || typeof data.currency !== 'string' || !Array.isArray(data.providers) || !data.providers.every((value: unknown) => typeof value === 'string')) throw new Error(t('copy.invalidBetHistoryResponse'));
  const items = data.items.map((row: unknown): BetRecord => {
    if (!isRecord(row) || typeof row.betId !== 'string' || typeof row.gameId !== 'string' || typeof row.gameName !== 'string' || typeof row.provider !== 'string' || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)) || !Number.isSafeInteger(row.betAmount) || Number(row.betAmount) < 0 || !Number.isSafeInteger(row.validBet) || Number(row.validBet) < 0 || !Number.isSafeInteger(row.profit)) throw new Error(t('copy.invalidBetHistoryResponse'));
    return { betId: row.betId, gameId: row.gameId, gameName: row.gameName, provider: row.provider, createdAt: row.createdAt, betAmount: Number(row.betAmount), validBet: Number(row.validBet), profit: Number(row.profit) };
  });
  return { items, count: Number(data.count), betAmount: Number(data.betAmount), profit: Number(data.profit), hasMore: data.hasMore, currency: data.currency, providers: data.providers as string[] };
}
export async function loadBetRecords(from: string, to: string, page: number, signal?: AbortSignal, provider = '') {
  const identity = await ensureSession();
  return parseBetRecords(await request('/api/game/records', { method: 'POST', signal, body: JSON.stringify({ uid: identity.uid, sid: identity.sid, from, to, page, provider }) }, t('copy.unableToReadBetHistoryPleaseRetry')));
}
