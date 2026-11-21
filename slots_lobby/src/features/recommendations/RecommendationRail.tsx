import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { navigateLobby } from '../../app/useLobbyRoute';
import { gameDisplay } from '../../app/games';
import { useLobbyGames } from '../home/useLobbyGames';
import { GameTile } from '../home/GameTile';
import { useGameFavorites } from '../home/useGameFavorites';
import { useGameRecommendations } from './useGameRecommendations';
import type { RecommendationScene } from '../../services/game-recommendations';
import '../../styles/recommendations.css';

export function RecommendationRail({ scene, gameId, onComingSoon }: { scene: RecommendationScene; gameId?: string; onComingSoon: () => void }) {
  const query = useGameRecommendations(scene, gameId);
  const catalog = useLobbyGames();
  const favorites = useGameFavorites();
  const railRef = useRef<HTMLDivElement>(null);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const excluded = new Set(favorites.data ?? []);
  if (gameId) excluded.add(gameId);
  const games = (query.data ?? []).map(item => catalog.data?.find(game => game.id === item.gameId)).filter((game): game is NonNullable<typeof game> => Boolean(game && game.enabled && !excluded.has(game.id))).slice(0, 12);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => { setCanPrevious(rail.scrollLeft > 2); setCanNext(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2); };
    update(); rail.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(rail);
    return () => { rail.removeEventListener('scroll', update); observer.disconnect(); };
  }, [games.length]);
  if (query.isPending) return null;
  if (query.isError) return null;
  if (!games.length) return null;
  const move = (direction: number) => railRef.current?.scrollBy({ left: direction * (railRef.current.clientWidth + 8), behavior: 'smooth' });
  return <section className="recommendation-rail" aria-label={t('recommendations.title')}>
    <header className="recommendation-heading"><h2><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>{t('recommendations.title')}</h2><div className="recommendation-controls"><button type="button" aria-label={t('recommendations.previous')} disabled={!canPrevious} onClick={() => move(-1)}>‹</button><button type="button" aria-label={t('recommendations.next')} disabled={!canNext} onClick={() => move(1)}>›</button></div></header>
    <div className="recommendation-rail-list" ref={railRef} tabIndex={0}>
      {games.map(game => { const display = gameDisplay(game.id, game); return <GameTile key={game.id} gameId={game.id} provider={game.provider} title={display.title} label={display.title} cover={game.cover} onEnter={game.enabled ? () => navigateLobby('game', { gameId: game.id }) : onComingSoon} />; })}
    </div>
  </section>;
}
