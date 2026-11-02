import { useQuery } from '@tanstack/react-query';
import { fetchGames } from '../../services/catalog';
export function useGames() {
  return useQuery({ queryKey: ['games'], queryFn: ({ signal }) => fetchGames(signal), staleTime: 60_000 });
}
