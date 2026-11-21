import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '../../stores/session';
import { fetchGameRecommendations, type RecommendationScene } from '../../services/game-recommendations';

export function useGameRecommendations(scene: RecommendationScene, gameId?: string) {
  const uid = useSessionStore(state => state.session?.uid);
  return useQuery({
    queryKey: ['game-recommendations', scene, gameId, uid],
    queryFn: ({ signal }) => fetchGameRecommendations(scene, gameId, signal),
    enabled: Boolean(uid) && (scene === 'favorites' || Boolean(gameId)),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
