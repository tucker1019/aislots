import { getLocale, t } from '../i18n';
import type { LobbyGame } from '../services/lobby-games';
export const lobbyGames = {
  AG1: {
    titleKey: 'copy.mahjongWays',
    frameTitleKey: 'copy.ag1MahjongWays',
    cover: '/assets/lobby/mahjong-icon.png',
  },
  AG2: {
    titleKey: 'copy.mahjongWays2',
    frameTitleKey: 'copy.mahjongWays2',
    cover: '/assets/lobby/games/1024.png',
  },
} as const;

export type GameId = string;

export function isGameId(value: string): value is GameId {
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
}

export function gameDisplay(gameId: string, entry?: LobbyGame) {
 const fallback = gameId === 'AG1' ? lobbyGames.AG1 : gameId === 'AG2' ? lobbyGames.AG2 : undefined;
 const title = entry ? (getLocale() === 'en-US' && entry.nameEn ? entry.nameEn : entry.name) : fallback ? t(fallback.titleKey) : gameId;
 return { title, frameTitle: gameId === 'AG1' ? `AG1 ${title}` : title, cover: entry?.cover ?? fallback?.cover ?? '', provider: entry?.provider ?? 'AG' };
}
