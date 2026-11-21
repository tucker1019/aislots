import {EmptyFavoritesIcon} from '../../components/EmptyFavoritesIcon';
import {message} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {useGameFavorites} from './useGameFavorites';
import {useSessionStore} from '../../stores/session';
import {useAuthStore} from '../../stores/auth';
import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { SlotsLoader } from '../../components/feedback/SlotsLoader';
import { FloatingBenefits } from './FloatingBenefits';
import { NoticeBar } from './NoticeBar';
import { PromotionBanner } from './PromotionBanner';
import { ProviderTabs } from './ProviderTabs';
import { GameTile } from './GameTile';
import type { AvailableProvider } from './content';
import { useLobbyGames } from './useLobbyGames';
import { getLocale } from '../../i18n';
import { NetworkError } from '../../components/feedback/NetworkError';
import { RecentWins } from './RecentWins';
import { coverPresentation } from './coverPresentation';
import { navigateLobby } from '../../app/useLobbyRoute';
import { RecommendationRail } from '../recommendations/RecommendationRail';

const GAMES_PER_BATCH = 6 * 3;


function preloadCover(cover: string) {
  const image = new Image();
  image.src = cover;
  return image.decode();
}

export function HomeContent({ onComingSoon, active=true }: { onComingSoon: () => void; active?:boolean }) {
  const [selected, setSelected] = useState<AvailableProvider>('hot');
  const [visibleCount, setVisibleCount] = useState(GAMES_PER_BATCH);
  const [loadingMore, setLoadingMore] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);
  const catalog = useLobbyGames();
  const favorites = useGameFavorites();
  const [toast,holder]=message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});
  const uid = useSessionStore(state=>state.session?.uid);
  const games = (catalog.data ?? []).filter(game => selected === 'hot' || (selected === 'favorites' ? Boolean(uid)&&Boolean(favorites.data?.includes(game.id)) : game.provider === selected));
  const hasMore = visibleCount < games.length;

  useEffect(() => {
    const games = (catalog.data ?? []).filter(game => selected === 'hot' || (selected === 'favorites' ? Boolean(uid)&&Boolean(favorites.data?.includes(game.id)) : game.provider === selected));
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

      const nextBatch = games.slice(visibleCount, visibleCount + GAMES_PER_BATCH);
      const ready = Promise.allSettled(nextBatch.map(game => preloadCover(coverPresentation(game.id, game.cover).src)));
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
  }, [hasMore, visibleCount, catalog.data, selected, favorites.data, uid]);

  useEffect(()=>{if(selected==='favorites'&&favorites.data&&favorites.isError)void toast.error({key:'favorites-refresh',content:t('favorites.failed')});},[selected,favorites.data,favorites.isError,toast]);
  const visibleGames = games.slice(0, visibleCount);

  return <>
    {holder}
    <FloatingBenefits />
    <NoticeBar />
    <PromotionBanner />
    <RecentWins active={active}/>
    <ProviderTabs selected={selected} onSelect={provider => { if(provider==='favorites'&&!uid){useAuthStore.getState().show('login',()=>setSelected('favorites'));return;} if (provider !== selected) { setSelected(provider); setVisibleCount(GAMES_PER_BATCH); setLoadingMore(false); } }} />
    <section className="home-game-list" aria-label={t('copy.gameList')}>
      <div className="home-game-grid">
        {visibleGames.map((game, index) => (
          <GameTile gameId={game.id} provider={game.provider} title={getLocale() !== 'zh-TW' && game.nameEn ? game.nameEn : game.name} key={game.id} cover={game.cover} label={game.id === 'AG1' ? t('copy.enterMahjongWays') : (getLocale() !== 'zh-TW' && game.nameEn ? game.nameEn : game.name)} onEnter={game.enabled ? () => navigateLobby('game', { gameId: game.id }) : onComingSoon} lazy={index >= 12 && index < GAMES_PER_BATCH} />
        ))}
        {catalog.isPending && <span className="home-game-catalog-state" role="status" aria-label={t('copy.loading')}><SlotsLoader className="slots-loader-home" /></span>}
        {catalog.isError && <div className="home-game-catalog-state"><NetworkError onRetry={() => void catalog.refetch()} disabled={catalog.isFetching}/></div>}
        {selected==='favorites' && uid && favorites.isPending && <span className="home-game-catalog-state" role="status" aria-label={t('copy.loading')}><SlotsLoader className="slots-loader-home"/></span>}
        {selected==='favorites' && uid && favorites.isError && !favorites.data && <div className="home-game-catalog-state"><NetworkError onRetry={()=>void favorites.refetch()} disabled={favorites.isFetching}/></div>}
        {catalog.isSuccess && !games.length && (selected!=='favorites'||favorites.isSuccess) && <div className={`home-game-catalog-state${selected==='favorites'?' home-favorites-empty':''}`}>{selected==='favorites'&&<EmptyFavoritesIcon/>}<p>{t(selected==='favorites'?'favorites.empty':'copy.comingSoon')}</p></div>}
      </div>
      {hasMore && <div className="home-game-list-end" ref={listEnd}>
        {loadingMore && <span role="status" aria-label={t('copy.loading')}><SlotsLoader className="slots-loader-home" /></span>}
      </div>}
      {selected === 'favorites' && uid && favorites.isSuccess && <RecommendationRail scene="favorites" onComingSoon={onComingSoon} />}
    </section>
  </>;
}
