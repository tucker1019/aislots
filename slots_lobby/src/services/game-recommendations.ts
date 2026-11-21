import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { isGameId } from '../app/games';
import { useSessionStore } from '../stores/session';
import { t } from '../i18n';

export type RecommendationScene = 'favorites' | 'game_play';
export interface GameRecommendation { gameId: string; score: string; supportUsers: number }

function parseRecommendations(value: unknown): GameRecommendation[] {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new Error(t('recommendations.failed'));
  return value.items.map((item: unknown): GameRecommendation => {
    if (!isRecord(item) || typeof item.gameId !== 'string' || !isGameId(item.gameId) || typeof item.score !== 'string' || typeof item.supportUsers !== 'number' || !Number.isSafeInteger(item.supportUsers) || item.supportUsers < 0) {
      throw new Error(t('recommendations.failed'));
    }
    return { gameId: item.gameId, score: item.score, supportUsers: item.supportUsers };
  });
}

export async function fetchGameRecommendations(scene: RecommendationScene, gameId?: string, signal?: AbortSignal): Promise<GameRecommendation[]> {
  const identity = await ensureSession();
  const data = await request('/api/game/recommendations', {
    method: 'POST', signal,
    body: JSON.stringify({ uid: identity.uid, sid: identity.sid, scene, ...(scene === 'game_play' ? { gameId } : {}) }),
  }, t('recommendations.failed'));
  const current = useSessionStore.getState().session;
  if (current?.uid !== identity.uid || current.sid !== identity.sid) throw new Error(t('copy.signInStateChangedPleaseRetry'));
  return parseRecommendations(data);
}
