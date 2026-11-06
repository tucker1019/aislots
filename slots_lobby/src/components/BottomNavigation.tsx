import {ClaimBadge} from '../features/rewards/ClaimBadge';
import {useClaimIndicators} from '../features/rewards/useClaimIndicators';
import { t } from '../i18n';
import { Icon } from './Icon';
const items = () => ([
  { label: t('copy.home'), icon: 'home' }, { label: t('copy.offers'), icon: 'gift' },
  { label: t('copy.deposit'), icon: 'wallet' }, { label: t('copy.earn'), icon: 'growth' }, { label: t('copy.myAccount'), icon: 'user' },
] as const);

export function BottomNavigation({ view, onNavigate }: { view: 'home' | 'my' | 'deposit' | 'earn' | 'offers'; onNavigate: (view: 'home' | 'my' | 'deposit' | 'earn' | 'offers') => void }) {
  const rewards=useClaimIndicators();
  return <nav className="bottom-navigation" aria-label={t('copy.bottomNavigation')}>
    {items().map((item, index) => <button type="button" key={item.label}
      aria-current={(index === 1 && view === 'offers') || (index === 0 && view === 'home') || (index === 4 && view === 'my') || (index === 2 && view === 'deposit') || (index === 3 && view === 'earn') ? 'page' : undefined} onClick={() => {
        onNavigate(index === 0 ? 'home' : index === 1 ? 'offers' : index === 2 ? 'deposit' : index === 3 ? 'earn' : 'my');
      }}><span className="bottom-navigation-icon claim-badge-anchor" aria-hidden="true"><Icon name={item.icon} size={23} /><ClaimBadge active={index===3?rewards.earn:index===4?rewards.my:false}/></span><span>{item.label}</span></button>)}
  </nav>;
}
