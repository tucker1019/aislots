import { Icon } from '../../components/Icon';
import { navigateLobby } from '../../app/useLobbyRoute';
import { t } from '../../i18n';
import { ClaimBadge } from '../rewards/ClaimBadge';
import { useClaimIndicators } from '../rewards/useClaimIndicators';

export function HomeShortcuts() {
  const rewards = useClaimIndicators();
  return <nav className="home-shortcuts" aria-label={t('copy.benefitsShortcuts')}>
    <button type="button" onClick={() => navigateLobby('benefits')}><span className="claim-badge-anchor"><Icon name="calendar" size={19}/><ClaimBadge active={rewards.active('checkin')}/></span>{t('copy.checkIn')}</button>
    <button type="button" onClick={() => navigateLobby('vip')}><span className="claim-badge-anchor"><Icon name="crown" size={19}/><ClaimBadge active={rewards.vip}/></span>VIP</button>
    <button type="button" onClick={() => navigateLobby('earn')}><span className="claim-badge-anchor"><Icon name="gift" size={19}/><ClaimBadge active={rewards.active('rebate')}/></span>{t('copy.rebateAmount')}</button>
  </nav>;
}
