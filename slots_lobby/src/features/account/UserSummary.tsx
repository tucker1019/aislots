import { t } from '../../i18n';
import { navigateLobby } from '../../app/useLobbyRoute';
import { coinsLabel } from './formatCoins';
import { Icon } from '../../components/Icon';
import { useAccountProfile } from './useAccountProfile';

export function UserSummary() {
  const { data, isPending, isError, isFetching, refetch, error } = useAccountProfile();
  const balance = data ? coinsLabel(data.coins) : undefined;
  const wallet = <>
      <Icon name="coin" size={19} />
      {isPending ? <span role="status" aria-label={t('copy.loadingUserProfile')}>{t('copy.connecting')}</span>
        : isError ? <button type="button" className="account-retry" aria-label={t('copy.reloadUserProfile')}
          title={error.message} disabled={isFetching} onClick={() => void refetch()}>{isFetching ? t('copy.loading') : t('copy.reload')}</button>
          : <output aria-label={t('copy.coinBalanceValue', {p0: balance ?? ''})} title={balance}>{balance}</output>}
  </>;
  return <div className="header-account">
    {isError ? <div className="header-wallet">{wallet}</div> : <button type="button" className="header-wallet" aria-label={t('copy.goToDeposit')} onClick={() => navigateLobby('deposit')}>{wallet}</button>}
    <button type="button" className="header-avatar-link" aria-label={t('copy.goToMyAccount')} onClick={() => navigateLobby('my')}><img className="header-avatar" src={data ? `/assets/profile/avatar/${data.avatarId}.png` : '/assets/profile/avatar/empty.png'}
      alt={data ? t('copy.valueSAvatar', {p0: data.nickname}) : t('copy.userAvatar')} width={38} height={38}
      onError={event => {
        const image = event.currentTarget;
        if (image.getAttribute('src') !== '/assets/profile/avatar/empty.png') image.src = '/assets/profile/avatar/empty.png';
      }} /></button>
  </div>;
}
