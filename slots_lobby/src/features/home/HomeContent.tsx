import { useRef, useState } from 'react';
import { NoticeBar } from './NoticeBar';
import { PromotionBanner } from './PromotionBanner';
import { ProviderTabs } from './ProviderTabs';
import { GameTile } from './GameTile';
import type { AvailableProvider } from './content';
import { navigateLobby } from '../../app/useLobbyRoute';
import { launchGame, rememberGameEntry } from '../../services/game-entry';

export function HomeContent({ onToast }: { onToast: (text: string) => void }) {
  const [selected, setSelected] = useState<AvailableProvider>('hot');
  const entering = useRef(false);
  const [loading, setLoading] = useState(false);
  async function enter() {
    if (entering.current) return;
    entering.current = true; setLoading(true);
    try { rememberGameEntry(await launchGame('AG1')); navigateLobby('game'); }
    catch (error) { onToast(error instanceof Error ? error.message : '暂时无法进入游戏，请重试'); }
    finally { entering.current = false; setLoading(false); }
  }
  return <>
    <NoticeBar />
    <PromotionBanner />
    <ProviderTabs selected={selected} onSelect={setSelected} onComingSoon={() => onToast('敬请期待')} />
    <section className="home-game-list" aria-label="游戏列表">
      <div className="home-game-grid"><GameTile loading={loading} onEnter={() => { void enter(); }} /></div>
    </section>
  </>;
}
