import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LobbyView } from '../features/games/types';
interface Preferences { favoriteIds: string[]; recentIds: string[] }
interface LobbyState extends Preferences {
  view: LobbyView;
  setView: (view: LobbyView) => void;
  toggleFavorite: (id: string) => void;
  recordVisit: (id: string) => void;
}
function ids(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string =>
    typeof item === 'string' && item.length > 0 && item.length <= 100))).slice(0, 100) : [];
}
/** 仅持久化本机偏好，不复制 Query 的游戏目录，也不存平台身份。 */
export const useLobbyStore = create<LobbyState>()(persist((set) => ({
  view: 'discover', favoriteIds: [], recentIds: [],
  setView: view => set({ view }),
  toggleFavorite: id => set(state => ({ favoriteIds: state.favoriteIds.includes(id)
    ? state.favoriteIds.filter(item => item !== id) : [...state.favoriteIds, id] })),
  recordVisit: id => set(state => ({ recentIds: [id, ...state.recentIds.filter(item => item !== id)].slice(0, 12) })),
}), {
  name: 'aislots-lobby-preferences', version: 1,
  partialize: state => ({ favoriteIds: state.favoriteIds, recentIds: state.recentIds }),
  merge: (persisted, current) => {
    if (!persisted || typeof persisted !== 'object') return current;
    const value = persisted as Partial<Preferences>;
    return { ...current, favoriteIds: ids(value.favoriteIds), recentIds: ids(value.recentIds).slice(0, 12) };
  },
}));
