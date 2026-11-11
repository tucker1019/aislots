import { request } from './account';
import { isRecord } from '../features/account/types';
import { isGameId } from '../app/games';
import { t } from '../i18n';
export interface LobbyGame { id: string; name: string; nameEn: string; provider: string; cover: string; enabled: boolean; sort: number }
function validCover(value: unknown): value is string {
 if (typeof value !== 'string') return false;
 if (value.startsWith('/assets/')) return !/[\\%?#\r\n]/.test(value) && new URL(value, 'https://local.example').pathname === value;
 try { const url = new URL(value); return url.protocol === 'https:' && !!url.host && !url.username && !url.password && !url.hash; } catch { return false; }
}
export function parseLobbyGames(value: unknown): LobbyGame[] {
 if (!isRecord(value) || !Array.isArray(value.games)) throw new Error(t('copy.invalidLobbyResponsePleaseRetry'));
 const ids = new Set<string>();
 return value.games.map((game: unknown): LobbyGame => {
  if (!isRecord(game) || typeof game.id !== 'string' || !isGameId(game.id) || ids.has(game.id) || typeof game.name !== 'string' || !game.name.trim() || typeof game.nameEn !== 'string' || typeof game.provider !== 'string' || !validCover(game.cover) || typeof game.enabled !== 'boolean' || typeof game.sort !== 'number' || !Number.isSafeInteger(game.sort) || game.sort < 0) throw new Error(t('copy.invalidLobbyResponsePleaseRetry'));
  ids.add(game.id);
  return { id: game.id, name: game.name, nameEn: game.nameEn, provider: game.provider, cover: game.cover, enabled: game.enabled, sort: game.sort };
 });
}
export async function fetchLobbyGames(signal?: AbortSignal): Promise<LobbyGame[]> {
 return parseLobbyGames(await request('/api/lobby/games', { signal }, t('copy.unableToConnectToTheLobbyPlease')));
}
