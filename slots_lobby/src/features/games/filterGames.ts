import type { Category, Game, LobbyView } from './types';
interface Filters { view: LobbyView; category: Category; query: string; favoriteIds: string[]; recentIds: string[] }
export function filterGames(games: Game[], filters: Filters): Game[] {
  const query = filters.query.trim().normalize('NFKC').toLocaleLowerCase();
  const selected = games.filter(game => {
    if (filters.view === 'favorites' && !filters.favoriteIds.includes(game.id)) return false;
    if (filters.view === 'recent' && !filters.recentIds.includes(game.id)) return false;
    if (filters.category !== 'all' && game.category !== filters.category) return false;
    return !query || [game.title, game.subtitle, ...game.tags].join(' ').normalize('NFKC').toLocaleLowerCase().includes(query);
  });
  return filters.view === 'recent'
    ? selected.sort((a, b) => filters.recentIds.indexOf(a.id) - filters.recentIds.indexOf(b.id)) : selected;
}
