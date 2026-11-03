import { Brand } from './Brand';
import { Icon } from './Icon';
import { UserSummary } from '../features/account/UserSummary';
import type { IconName } from './Icon';
import type { LobbyView } from '../features/games/types';
const links: { id: LobbyView; label: string; icon: IconName }[] = [
  { id: 'discover', label: '发现', icon: 'grid' },
  { id: 'favorites', label: '我的收藏', icon: 'heart' },
  { id: 'recent', label: '最近玩过', icon: 'clock' },
];
interface HeaderProps {
  view: LobbyView; favoriteCount: number; onNavigate: (view: LobbyView) => void;
}
export function Header({ view, favoriteCount, onNavigate }: HeaderProps) {
  return <>
    <header className="site-header">
      <div className="header-inner">
        <button className="brand-home" aria-label="AISlots 首页" onClick={() => onNavigate('discover')}><Brand /></button>
        <UserSummary />
      </div>
    </header>
    <nav className="mobile-navigation" aria-label="主导航">
      {links.map(link => <button key={link.id} className={view === link.id ? 'is-active' : ''}
        aria-current={view === link.id ? 'page' : undefined} onClick={() => onNavigate(link.id)}>
        <Icon name={link.icon} size={21} /><span>{link.id === 'favorites' ? `收藏${favoriteCount > 0 ? ` ${favoriteCount}` : ''}` : link.label}</span>
      </button>)}
    </nav>
  </>;
}
