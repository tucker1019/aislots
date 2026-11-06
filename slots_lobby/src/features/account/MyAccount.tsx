import {ThemeSelector} from './ThemeSelector';
import {ClaimBadge} from '../rewards/ClaimBadge';
import {useClaimIndicators} from '../rewards/useClaimIndicators';
import type {RewardKey} from '../rewards/claimIndicators';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import {NetworkError} from '../../components/feedback/NetworkError';
import {navigateLobby} from '../../app/useLobbyRoute';
import { LanguageSelector } from './LanguageSelector';
import { t } from '../../i18n';
import { WalletBalance } from './WalletBalance';
import { useQuery } from '@tanstack/react-query';
import { loadVipOverview } from '../../services/benefits';
import { useSessionStore } from '../../stores/session';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useAccountProfile } from './useAccountProfile';
interface AccountAction {id:string;icon:IconName;label:string;shortLabel?:string}
const benefits = ():AccountAction[] => [
 {id:'checkin',icon:'calendar',label:t('copy.dailyCheckIn'),shortLabel:t('account.shortcut.checkin')},
 {id:'weekly',icon:'gift',label:t('copy.weeklyGift'),shortLabel:t('account.shortcut.weekly')},
 {id:'monthly',icon:'calendar',label:t('copy.monthlyGift'),shortLabel:t('account.shortcut.monthly')},
 {id:'upgrade',icon:'growth',label:t('copy.levelUpReward'),shortLabel:t('account.shortcut.upgrade')},
 {id:'vip',icon:'crown',label:t('copy.vipCenter'),shortLabel:t('account.shortcut.vip')},
];
const management = ():AccountAction[] => [
 {id:'ledger',icon:'list',label:t('copy.walletTransactions'),shortLabel:t('account.shortcut.ledger')},
 {id:'records',icon:'transfer',label:t('copy.depositHistory'),shortLabel:t('account.shortcut.records')},
 {id:'wallet',icon:'wallet',label:t('copy.walletManagement'),shortLabel:t('account.shortcut.wallet')},
 {id:'bets',icon:'list',label:t('copy.betHistory'),shortLabel:t('account.shortcut.bets')},
 {id:'report',icon:'report',label:t('copy.personalReport'),shortLabel:t('account.shortcut.report')},
 {id:'invite',icon:'users',label:t('copy.inviteFriends'),shortLabel:t('account.shortcut.invite')},
 {id:'agent',icon:'growth',label:t('copy.agentCenter'),shortLabel:t('account.shortcut.agent')},
];
function ActionGrid({items,onAction,label}:{items:AccountAction[];onAction:(id:string)=>void;label:string;shortLabel?:string}) {
 const rewards=useClaimIndicators();
 return <div className="account-actions" aria-label={label}>{items.map(item=><button type="button" key={item.id} aria-label={item.label} title={item.label} onClick={()=>onAction(item.id)}><span className="account-action-icon claim-badge-anchor" aria-hidden="true"><Icon name={item.icon} size={21}/><ClaimBadge active={item.id==='vip'?rewards.vip:item.id==='invite'?false:rewards.active(item.id as RewardKey)}/></span><span className="account-action-label">{item.shortLabel??item.label}</span></button>)}</div>;
}
export function MyAccount({ onAction, onDeposit, onRecords, onBetRecords, onBenefits, onLedger, onReport, onInvite, onAgent, onWallet, onWithdraw, onSettings }: { onAction: () => void; onDeposit: () => void; onRecords: () => void; onBetRecords?: () => void; onBenefits?: () => void; onLedger?: () => void; onReport?: () => void; onInvite?: () => void; onAgent?: () => void; onWallet?: () => void; onWithdraw?: () => void; onSettings?: () => void }) {
  const { data, isPending, isError, isFetching, refetch } = useAccountProfile();
  const uid = useSessionStore(state => state.session?.uid);
  const vip = useQuery({ queryKey: ['lobby', 'benefits', 'vip', uid], queryFn: ({ signal }) => loadVipOverview(signal), enabled: Boolean(uid), retry: false, staleTime: 15000 });
  return <section className="my-account" aria-label={t('copy.myAccountDetails')}>
    <div className="account-identity">
      {data ? <img src={`/assets/profile/avatar/${data.avatarId}.png`} alt={t('copy.valueSAvatar', {p0: data.nickname})} width={52} height={52} /> : <span className="account-avatar-placeholder" aria-hidden="true"><Icon name="user" size={28}/></span>}
      <div className="account-identity-text"><div className="account-vip-row">{vip.data ? <span className="account-vip-badge" aria-label={t('copy.vipLevelValue', {p0: vip.data.level})}><Icon name="crown" size={12} />VIP{vip.data.level}</span> : <AsyncButton loading={vip.isFetching} type="button" className="account-vip-badge" disabled={vip.isPending || vip.isFetching} onClick={() => void vip.refetch()} aria-label={t('copy.reloadVipLevel')}>{vip.isError ? t('copy.retryVip') : 'VIP…'}</AsyncButton>}</div><h1 title={data?.nickname}>{data?.nickname??<span className="account-data-placeholder account-name-placeholder" aria-label={t('copy.loadingProfile')}/>}</h1><p>{t('common.idLabel')}{data?.uid??uid??'—'}</p></div>
      <button type="button" className="account-settings" aria-label={t('copy.settings')} onClick={onSettings??onAction}><Icon name="settings" size={21} /></button>
      <button type="button" className="account-settings" aria-label={t('copy.messages')} onClick={onAction}><Icon name="mail" size={21} /></button>
    </div>
    <div className="account-balance-card">
      <div><span className="account-caption">{t('copy.walletBalance')}</span>{data ? <WalletBalance coins={data.coins} isFetching={isFetching} onRefresh={refetch} /> : <div className="account-balance" aria-busy={isPending}>{isPending?<span className="account-data-placeholder account-balance-placeholder" aria-label={t('copy.refreshingWalletBalance')}/>:<span className="wallet-amount">—</span>}</div>}</div>
      <div className="account-money-actions"><button type="button" onClick={onDeposit}>{t('copy.deposit')}</button><button type="button" onClick={onWithdraw ?? onAction}>{t('copy.withdraw')}</button></div>
    </div>
    {isError&&!data&&<div className="account-profile-error"><NetworkError disabled={isFetching} onRetry={()=>void refetch()}/></div>}
    {isError && data && <p role="alert" className="account-refresh-error">{t('copy.balanceRefreshFailedPleaseRetry')}</p>}
    <section className="account-card"><div className="account-section-heading"><h2>{t('copy.benefitsCenter')}</h2><span>{t('copy.discoverYourBenefits')}</span></div><ActionGrid items={benefits()} label={t('copy.benefitsShortcuts')} onAction={onBenefits ?? onAction} /></section>
    <section className="account-card"><div className="account-section-heading"><h2>{t('copy.accountServices')}</h2></div><ActionGrid items={management()} label={t('copy.accountManagementShortcuts')} onAction={name => { if(name === 'wallet' && onWallet) onWallet(); else if(name === 'agent' && onAgent) onAgent(); else if(name === 'invite' && onInvite) onInvite(); else if (name === 'report' && onReport) onReport(); else if (name === 'ledger' && onLedger) onLedger(); else if (name === 'bets' && onBetRecords) onBetRecords(); else if (name === 'records') onRecords(); else onAction(); }} /></section>
    <section className="account-card account-help" aria-label={t('copy.helpAndSecurity')}><button type="button" onClick={()=>navigateLobby('security')}><span className="account-help-icon" aria-hidden="true"><Icon name="shield" size={17}/></span><span>{t('copy.securityCenter')}</span><span aria-hidden="true"><Icon name="chevron" size={16}/></span></button><LanguageSelector /><ThemeSelector /></section>
  </section>;
}
