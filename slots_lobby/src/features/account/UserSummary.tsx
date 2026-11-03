import { coinsLabel } from './formatCoins';
import { Icon } from '../../components/Icon';
import { useAccountProfile } from './useAccountProfile';

export function UserSummary() {
  const { data, isPending, isError, isFetching, refetch, error } = useAccountProfile();
  const balance = data ? coinsLabel(data.coins) : undefined;
  return <div className="header-account">
    <div className="header-wallet">
      <Icon name="coin" size={19} />
      {isPending ? <span role="status" aria-label="正在加载用户资料">连接中…</span>
        : isError ? <button type="button" className="account-retry" aria-label="重新加载用户资料"
          title={error.message} disabled={isFetching} onClick={() => void refetch()}>{isFetching ? '加载中…' : '重新加载'}</button>
          : <output aria-label={`金币余额 ${balance}`} title={balance}>{balance}</output>}
    </div>
    <img className="header-avatar" src={data ? `/assets/profile/avatar/${data.avatarId}.png` : '/assets/profile/avatar/empty.png'}
      alt={data ? `${data.nickname}的头像` : '用户头像'} width={38} height={38}
      onError={event => {
        const image = event.currentTarget;
        if (image.getAttribute('src') !== '/assets/profile/avatar/empty.png') image.src = '/assets/profile/avatar/empty.png';
      }} />
  </div>;
}
