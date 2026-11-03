import { useQuery } from '@tanstack/react-query';
import { loadVipOverview } from '../../services/benefits';
import { useSessionStore } from '../../stores/session';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useAccountProfile } from './useAccountProfile';
import { coinsLabel } from './formatCoins';
const benefits: [IconName,string][] = [['calendar','每日签到'],['gift','每周礼金'],['calendar','每月礼金'],['growth','晋级奖励'],['crown','VIP中心']];
const management: [IconName,string][] = [['list','资金明细'],['transfer','存取记录'],['wallet','钱包管理'],['list','投注记录'],['report','个人报表'],['users','邀请好友'],['growth','代理中心']];
function ActionGrid({ items, onAction, label }: { items: [IconName,string][]; onAction: (name: string) => void; label: string }) {
  return <div className="account-actions" aria-label={label}>{items.map(([icon, name]) => <button type="button" key={name} onClick={() => onAction(name)}>
    <span className="account-action-icon" aria-hidden="true"><Icon name={icon} size={21} /></span><span>{name}</span>
  </button>)}</div>;
}
export function MyAccount({ onAction, onDeposit, onRecords, onBetRecords, onBenefits, onLedger }: { onAction: () => void; onDeposit: () => void; onRecords: () => void; onBetRecords?: () => void; onBenefits?: () => void; onLedger?: () => void }) {
  const { data, isPending, isError, isFetching, refetch } = useAccountProfile();
  const uid = useSessionStore(state => state.session?.uid);
  const vip = useQuery({ queryKey: ['lobby', 'benefits', 'vip', uid], queryFn: ({ signal }) => loadVipOverview(signal), enabled: Boolean(uid), retry: false, staleTime: 15000 });
  if (isPending) return <section className="my-account" role="status">正在加载个人资料…</section>;
  if (isError || !data) return <section className="my-account" role="alert"><p>个人资料暂时无法加载</p><button type="button" disabled={isFetching} onClick={() => void refetch()}>{isFetching ? '加载中…' : '重试'}</button></section>;
  return <section className="my-account" aria-label="我的账户">
    <div className="account-identity">
      <img src={`/assets/profile/avatar/${data.avatarId}.png`} alt={`${data.nickname}的头像`} width={52} height={52} />
      <div className="account-identity-text"><div className="account-name-row"><h1 title={data.nickname}>{data.nickname}</h1>{vip.data ? <span className="account-vip-badge" aria-label={`VIP等级 ${vip.data.level}`}><Icon name="crown" size={12} />VIP{vip.data.level}</span> : <button type="button" className="account-vip-badge" disabled={vip.isPending || vip.isFetching} onClick={() => void vip.refetch()} aria-label="重新加载VIP等级">{vip.isError ? 'VIP重试' : 'VIP…'}</button>}</div><p>ID：{data.uid}</p></div>
      <button type="button" className="account-settings" aria-label="设置" onClick={onAction}><Icon name="settings" size={21} /></button>
      <button type="button" className="account-settings" aria-label="消息" onClick={onAction}><Icon name="mail" size={21} /></button>
    </div>
    <div className="account-balance-card">
      <div><span className="account-caption">钱包余额</span><div className="account-balance">{coinsLabel(data.coins)}<button type="button" aria-label="刷新钱包余额" disabled={isFetching} onClick={() => void refetch()}>{isFetching ? '…' : <Icon name="refresh" size={17} />}</button></div></div>
      <div className="account-money-actions"><button type="button" onClick={onDeposit}>存款</button><button type="button" onClick={onAction}>取款</button></div>
    </div>
    <section className="account-card"><div className="account-section-heading"><h2>福利中心</h2><span>发现属于你的福利</span></div><ActionGrid items={benefits} label="福利入口" onAction={onBenefits ?? onAction} /></section>
    <section className="account-card"><div className="account-section-heading"><h2>账户服务</h2></div><ActionGrid items={management} label="账户管理入口" onAction={name => { if (name === '资金明细' && onLedger) onLedger(); else if (name === '投注记录' && onBetRecords) onBetRecords(); else if (name === '存取记录') onRecords(); else onAction(); }} /></section>
    <section className="account-card account-help" aria-label="帮助与安全">{['安全中心', '关于我们', '常见问题'].map((name, index) => <button type="button" key={name} onClick={onAction}><span className="account-help-icon" aria-hidden="true"><Icon name={(['shield','info','help'] as const)[index]} size={17} /></span><span>{name}</span><span aria-hidden="true"><Icon name="chevron" size={16} /></span></button>)}</section>
  </section>;
}
