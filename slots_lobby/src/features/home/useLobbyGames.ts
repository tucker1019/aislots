import { useQuery } from '@tanstack/react-query';
import { fetchLobbyGames } from '../../services/lobby-games';
export const lobbyGamesKey = ['lobby', 'games'] as const;
export function useLobbyGames() {
 return useQuery({ queryKey: lobbyGamesKey, queryFn: () => fetchLobbyGames(), staleTime: 30000, refetchOnWindowFocus: true, retry: false });
}
