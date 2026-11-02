import { Button, Tooltip } from 'antd';
import { Brand } from './Brand';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { LobbyView } from '../features/games/types';
const links: { id: LobbyView; label: string; icon: IconName }[] = [
  { id: 'discover', label: '发现', icon: 'grid' },
  { id: 'favorites', label: '我的收藏', icon: 'heart' },
  { id: 'recent', label: '最近玩过', icon: 'clock' },
];
interface HeaderProps {
  view: LobbyView; favoriteCount: number; onNavigate: (view: LobbyView) => void;
  onSearch: () => void; onAbout: () => void;
}
export function Header({ view, favoriteCount, onNavigate, onSearch, onAbout }: HeaderProps) {
  return <>
    <header className="site-header">
      <div className="header-inner">
        <button className="brand-home" aria-label="AISlots 首页" onClick={() => onNavigate('discover')}><Brand /></button>
        <nav className="desktop-navigation" aria-label="主导航">
          {links.map(link => <button key={link.id} onClick={() => onNavigate(link.id)}
            className={view === link.id ? 'nav-link is-active' : 'nav-link'} aria-current={view === link.id ? 'page' : undefined}>
            {link.label}{link.id === 'favorites' && favoriteCount > 0 && <span className="nav-count">{favoriteCount}</span>}
          </button>)}
        </nav>
        <div className="header-actions">
          <Tooltip title="搜索游戏"><Button type="text" aria-label="搜索游戏" className="header-icon" icon={<Icon name="search" />} onClick={onSearch} /></Tooltip>
          <span className="header-divider" />
          <Button type="text" className="about-button" onClick={onAbout}>关于 AISlots <Icon name="chevron" size={13} /></Button>
          <Button type="text" className="mobile-about" aria-label="关于 AISlots" icon={<Icon name="info" />} onClick={onAbout} />
        </div>
      </div>
    </header>
    <nav className="mobile-navigation" aria-label="手机导航">
      {links.map(link => <button key={link.id} className={view === link.id ? 'is-active' : ''}
        aria-current={view === link.id ? 'page' : undefined} onClick={() => onNavigate(link.id)}>
        <Icon name={link.icon} size={21} /><span>{link.id === 'favorites' ? '收藏' : link.label}</span>
      </button>)}
    </nav>
  </>;
}
