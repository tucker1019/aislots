import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { useDepositBonusLabel } from '../deposit/useDepositBonusLabel';
import { navigateLobby } from '../../app/useLobbyRoute';
import { coinsLabel } from './formatCoins';
import { Icon } from '../../components/Icon';
import { useAccountProfile } from './useAccountProfile';

export function UserSummary({showDeposit=true,showAvatar=true}:{showDeposit?:boolean;showAvatar?:boolean} = {}) {
  const { data, isPending, isError, isFetching, refetch, error } = useAccountProfile();
  const balance = data ? coinsLabel(data.coins) : undefined;
  const [heldBalance, setHeldBalance] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimer.current !== null) clearTimeout(refreshTimer.current); }, []);
  const refreshing = isFetching || heldBalance !== null;
  const displayedBalance = heldBalance ?? balance;
  const refreshBalance = () => {
    if (refreshing || refreshTimer.current !== null) return;
    setHeldBalance(balance ?? coinsLabel(0));
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      setHeldBalance(null);
    }, 500);
    void refetch();
  };
  const bonusLabel = useDepositBonusLabel(data?.uid, showDeposit);
  return <div className="header-account">
    <div className="header-wallet">
      <button type="button" className="header-balance-refresh" aria-label={t('copy.refreshWalletBalance')}
        title={isError ? error.message : t('copy.refreshWalletBalance')} disabled={refreshing} data-loading={refreshing}
        onClick={refreshBalance}><Icon name="refresh" size={16} /></button>
      <div className="header-balance-value" aria-busy={refreshing}>
        <output aria-hidden={isPending || refreshing} aria-label={isPending || refreshing ? undefined : t('copy.coinBalanceValue', { p0: displayedBalance ?? '' })} title={displayedBalance}>
          {heldBalance ?? (isError && !data ? '—' : balance ?? coinsLabel(0))}
        </output>
        {(isPending || refreshing) && <span className="header-balance-dots" role="status" aria-label={t('copy.refreshingWalletBalance')}>
          <i /><i /><i />
        </span>}
      </div>
      {showDeposit && <button type="button" className="header-deposit" aria-label={t('copy.goToDeposit')} onClick={() => navigateLobby('deposit')}>
        {t('copy.deposit')}
        {bonusLabel && <span className="header-deposit-bonus">{bonusLabel}</span>}
      </button>}
    </div>
    {showAvatar && <button type="button" className="header-avatar-link" aria-label={t('copy.goToMyAccount')} onClick={() => navigateLobby('my')}><img className="header-avatar" src={data ? `/assets/profile/avatar/${data.avatarId}.png` : '/assets/profile/avatar/empty.png'}
      alt={data ? t('copy.valueSAvatar', {p0: data.nickname}) : t('copy.userAvatar')} width={38} height={38}
      onError={event => {
        const image = event.currentTarget;
        if (image.getAttribute('src') !== '/assets/profile/avatar/empty.png') image.src = '/assets/profile/avatar/empty.png';
      }} /></button>}
  </div>;
}
