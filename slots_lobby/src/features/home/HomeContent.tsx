import { t } from '../../i18n';
import { useState } from 'react';
import { NoticeBar } from './NoticeBar';
import { PromotionBanner } from './PromotionBanner';
import { ProviderTabs } from './ProviderTabs';
import { GameTile } from './GameTile';
import type { AvailableProvider } from './content';
import { navigateLobby } from '../../app/useLobbyRoute';

export function HomeContent() {
  const [selected, setSelected] = useState<AvailableProvider>('hot');
  return <>
    <NoticeBar />
    <PromotionBanner />
    <ProviderTabs selected={selected} onSelect={setSelected} />
    <section className="home-game-list" aria-label={t('copy.gameList')}>
      <div className="home-game-grid"><GameTile loading={false} onEnter={() => navigateLobby('game')} /></div>
    </section>
  </>;
}
