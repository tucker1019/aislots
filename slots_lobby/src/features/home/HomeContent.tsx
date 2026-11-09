import { t } from '../../i18n';
import { useState } from 'react';
import { NoticeBar } from './NoticeBar';
import { PromotionBanner } from './PromotionBanner';
import { ProviderTabs } from './ProviderTabs';
import { GameTile } from './GameTile';
import { mahjongGame, type AvailableProvider } from './content';
import { comingSoonGames } from './comingSoonGames';
import { navigateLobby } from '../../app/useLobbyRoute';

export function HomeContent({ onComingSoon }: { onComingSoon: () => void }) {
  const [selected, setSelected] = useState<AvailableProvider>('hot');
  return <>
    <NoticeBar />
    <PromotionBanner />
    <ProviderTabs selected={selected} onSelect={setSelected} />
    <section className="home-game-list" aria-label={t('copy.gameList')}>
      <div className="home-game-grid">
        <GameTile cover={mahjongGame().cover} label={t('copy.enterMahjongWays')} onEnter={() => navigateLobby('game')} />
        {selected === 'hot' && comingSoonGames.map(([id, title], index) => (
          <GameTile key={id} cover={`/assets/lobby/games/${id}.png`} label={title} onEnter={onComingSoon} lazy={index >= 11} />
        ))}
      </div>
    </section>
  </>;
}
