import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { isGameId } from '../app/games';
import { useSessionStore } from '../stores/session';
import type { Session } from '../features/account/types';
import { t } from '../i18n';

export function parseGameFavorites(data: unknown): string[] {
 if (!isRecord(data) || !Array.isArray(data.gameIds) || !data.gameIds.every(id => typeof id === 'string' && isGameId(id))) throw new Error(t('favorites.failed'));
 return [...new Set(data.gameIds)];
}
function requireCurrent(identity: Session) {
 const current = useSessionStore.getState().session;
 if (current?.uid !== identity.uid || current.sid !== identity.sid) throw new Error(t('copy.signInStateChangedPleaseRetry'));
}
export async function fetchGameFavorites(signal?: AbortSignal): Promise<string[]> {
 const identity = await ensureSession(); requireCurrent(identity);
 const data = await request('/api/game/favorites', { method: 'POST', signal, body: JSON.stringify({ uid: identity.uid, sid: identity.sid }) }, t('favorites.failed'));
 requireCurrent(identity); return parseGameFavorites(data);
}
export async function setGameFavorite(gameId: string, favorite: boolean): Promise<string[]> {
 const identity = await ensureSession(); requireCurrent(identity);
 const data = await request('/api/game/favorites/set', { method: 'POST', body: JSON.stringify({ uid: identity.uid, sid: identity.sid, gameId, favorite }) }, t('favorites.failed'));
 requireCurrent(identity); return parseGameFavorites(data);
}
