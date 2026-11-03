import { Icon } from './Icon';
const items = [
  { label: '首页', icon: 'home' }, { label: '优惠', icon: 'gift' },
  { label: '存款', icon: 'wallet' }, { label: '赚钱', icon: 'growth' }, { label: '我的', icon: 'user' },
] as const;

export function BottomNavigation({ view, onNavigate, onComingSoon }: { view: 'home' | 'my' | 'deposit' | 'earn'; onNavigate: (view: 'home' | 'my' | 'deposit' | 'earn') => void; onComingSoon: () => void }) {
  return <nav className="bottom-navigation" aria-label="底部导航">
    {items.map((item, index) => <button type="button" key={item.label}
      aria-current={(index === 0 && view === 'home') || (index === 4 && view === 'my') || (index === 2 && view === 'deposit') || (index === 3 && view === 'earn') ? 'page' : undefined} onClick={() => {
        if (index === 0 || index === 4 || index === 2 || index === 3) onNavigate(index === 0 ? 'home' : index === 2 ? 'deposit' : index === 3 ? 'earn' : 'my');
        else onComingSoon();
      }}><span className="bottom-navigation-icon" aria-hidden="true"><Icon name={item.icon} size={23} /></span><span>{item.label}</span></button>)}
  </nav>;
}
