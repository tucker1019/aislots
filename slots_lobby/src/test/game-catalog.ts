import defaults from '../../../lobby_service/etc/games.json';
import type { LobbyGame } from '../services/lobby-games';
export const testGames: LobbyGame[] = Object.entries(defaults.games).map(([id, game]) => ({ theoreticalRtp:97, volatility:'medium' as const, maxWin:-1, id, name: game.name, nameEn: game.nameEn, cover: game.cover, provider: game.provider, enabled: game.enabled, sort: game.sort })).sort((a, b) => a.sort - b.sort);
