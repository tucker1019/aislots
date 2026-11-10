import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { NoticeBar } from './NoticeBar';
import { PromotionBanner } from './PromotionBanner';
import { ProviderTabs } from './ProviderTabs';
import { GameTile } from './GameTile';
import { mahjongGame, type AvailableProvider } from './content';
import { comingSoonGames } from './comingSoonGames';
import { navigateLobby } from '../../app/useLobbyRoute';

const GAMES_PER_BATCH = 6 * 3;
const gameCover = (id: string) => `/assets/lobby/games/${id}.png`;

function preloadCover(id: string) {
  const image = new Image();
  image.src = gameCover(id);
  return image.decode();
}

export function HomeContent({ onComingSoon }: { onComingSoon: () => void }) {
  const [selected, setSelected] = useState<AvailableProvider>('hot');
  const [visibleCount, setVisibleCount] = useState(GAMES_PER_BATCH);
  const [loadingMore, setLoadingMore] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);
  const hasMore = selected === 'hot' && visibleCount < comingSoonGames.length + 1;

  useEffect(() => {
    const target = listEnd.current;
    const scrollRoot = target?.closest('#root');
    if (!hasMore || !target || !scrollRoot || typeof IntersectionObserver === 'undefined') return;
    let active = true;
    let started = false;
    let minimumDelay: number | undefined;
    let loadDeadline: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!active || !entry?.isIntersecting || started) return;
      started = true;
      setLoadingMore(true);

      const nextBatch = comingSoonGames.slice(visibleCount - 1, visibleCount - 1 + GAMES_PER_BATCH);
      const ready = Promise.allSettled(nextBatch.map(([id]) => preloadCover(id)));
      const deadline = new Promise<void>(resolve => { loadDeadline = window.setTimeout(resolve, 3000); });
      const delay = new Promise<void>(resolve => { minimumDelay = window.setTimeout(resolve, 300); });
      void Promise.all([Promise.race([ready, deadline]), delay]).then(() => {
        if (!active) return;
        window.clearTimeout(loadDeadline);
        setVisibleCount(count => count + GAMES_PER_BATCH);
        setLoadingMore(false);
      });
    }, { root: scrollRoot, rootMargin: '0px 0px 160px 0px' });
    observer.observe(target);
    return () => {
      active = false;
      observer.disconnect();
      window.clearTimeout(minimumDelay);
      window.clearTimeout(loadDeadline);
    };
  }, [hasMore, visibleCount]);

  return <>
    <NoticeBar />
    <PromotionBanner />
    <ProviderTabs selected={selected} onSelect={provider => { if (provider !== selected) { setSelected(provider); setLoadingMore(false); } }} />
    <section className="home-game-list" aria-label={t('copy.gameList')}>
      <div className="home-game-grid">
        <GameTile cover={mahjongGame().cover} label={t('copy.enterMahjongWays')} onEnter={() => navigateLobby('game')} />
        {selected === 'hot' && comingSoonGames.slice(0, visibleCount - 1).map(([id, title], index) => (
          <GameTile key={id} cover={gameCover(id)} label={title} onEnter={onComingSoon} lazy={index >= 11 && index < GAMES_PER_BATCH - 1} />
        ))}
      </div>
      {selected === 'hot' && <div className="home-game-list-end" ref={listEnd}>
        {loadingMore && <span role="status" aria-label={t('copy.loading')}><Spin size="small" /></span>}
      </div>}
    </section>
  </>;
}
