import { t } from '../i18n';
import { Icon } from './Icon';
const items = () => ([
  { label: t('copy.home'), icon: 'home' }, { label: t('copy.offers'), icon: 'gift' },
  { label: t('copy.deposit'), icon: 'wallet' }, { label: t('copy.earn'), icon: 'growth' }, { label: t('copy.myAccount'), icon: 'user' },
] as const);

export function BottomNavigation({ view, onNavigate, onComingSoon }: { view: 'home' | 'my' | 'deposit' | 'earn'; onNavigate: (view: 'home' | 'my' | 'deposit' | 'earn') => void; onComingSoon: () => void }) {
  return <nav className="bottom-navigation" aria-label={t('copy.bottomNavigation')}>
    {items().map((item, index) => <button type="button" key={item.label}
      aria-current={(index === 0 && view === 'home') || (index === 4 && view === 'my') || (index === 2 && view === 'deposit') || (index === 3 && view === 'earn') ? 'page' : undefined} onClick={() => {
        if (index === 0 || index === 4 || index === 2 || index === 3) onNavigate(index === 0 ? 'home' : index === 2 ? 'deposit' : index === 3 ? 'earn' : 'my');
        else onComingSoon();
      }}><span className="bottom-navigation-icon" aria-hidden="true"><Icon name={item.icon} size={23} /></span><span>{item.label}</span></button>)}
  </nav>;
}
