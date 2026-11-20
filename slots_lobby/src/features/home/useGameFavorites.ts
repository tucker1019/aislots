import { useQuery } from '@tanstack/react-query';
import { fetchGameFavorites } from '../../services/game-favorites';
import { useSessionStore } from '../../stores/session';
export const gameFavoritesKey = (uid: number | undefined) => ['lobby', 'game-favorites', uid] as const;
export function useGameFavorites() {
 const uid = useSessionStore(state => state.session?.uid);
 return useQuery({ queryKey: gameFavoritesKey(uid), queryFn: ({signal}) => fetchGameFavorites(signal), enabled: Boolean(uid), retry: false, staleTime: 30000, refetchOnWindowFocus: true });
}
