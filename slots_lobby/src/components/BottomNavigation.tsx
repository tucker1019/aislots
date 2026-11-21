import { useDepositBonusLabel } from '../features/deposit/useDepositBonusLabel';
import { useSessionStore } from '../stores/session';
import {ClaimBadge} from '../features/rewards/ClaimBadge';
import {useClaimIndicators} from '../features/rewards/useClaimIndicators';
import { t } from '../i18n';
import { Icon } from './Icon';
type BottomView = 'home' | 'deposit' | 'earn' | 'my';
const items = () => ([
  { view: 'home', label: t('copy.home'), icon: 'home' },
  { view: 'deposit', label: t('copy.deposit'), icon: 'wallet' },
  { view: 'earn', label: t('copy.earn'), icon: 'growth' },
  { view: 'my', label: t('copy.myAccount'), icon: 'user' },
] as const);

export function BottomNavigation({ view, onNavigate }: { view: BottomView; onNavigate: (view: BottomView) => void }) {
  const rewards=useClaimIndicators();
  const bonusLabel = useDepositBonusLabel(useSessionStore(state => state.session?.uid));
  return <nav className="bottom-navigation" aria-label={t('copy.bottomNavigation')}>
    {items().map(item => <button type="button" key={item.view}
      aria-label={item.label} aria-current={view === item.view ? 'page' : undefined} onClick={() => onNavigate(item.view)}>
      <span className="bottom-navigation-icon claim-badge-anchor" aria-hidden="true"><Icon name={item.icon} size={23} />
        <ClaimBadge active={item.view==='home'?rewards.home:item.view==='earn'?rewards.earn:item.view==='my'?rewards.my:false}/>
        {item.view === 'deposit' && bonusLabel && <span className="header-deposit-bonus bottom-deposit-bonus">{bonusLabel}</span>}
      </span><span className="bottom-navigation-label">{item.label}</span>
    </button>)}
  </nav>;
}
