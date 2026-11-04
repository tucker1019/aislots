import {LoadingState} from '../../components/feedback/LoadingState';
import {NetworkError} from '../../components/feedback/NetworkError';
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
 return <div className="account-actions" aria-label={label}>{items.map(item=><button type="button" key={item.id} aria-label={item.label} title={item.label} onClick={()=>onAction(item.id)}><span className="account-action-icon" aria-hidden="true"><Icon name={item.icon} size={21}/></span><span className="account-action-label">{item.shortLabel??item.label}</span></button>)}</div>;
}
export function MyAccount({ onAction, onDeposit, onRecords, onBetRecords, onBenefits, onLedger, onReport, onInvite, onAgent, onWallet, onWithdraw, onSettings }: { onAction: () => void; onDeposit: () => void; onRecords: () => void; onBetRecords?: () => void; onBenefits?: () => void; onLedger?: () => void; onReport?: () => void; onInvite?: () => void; onAgent?: () => void; onWallet?: () => void; onWithdraw?: () => void; onSettings?: () => void }) {
  const { data, isPending, isError, isFetching, refetch } = useAccountProfile();
  const uid = useSessionStore(state => state.session?.uid);
  const vip = useQuery({ queryKey: ['lobby', 'benefits', 'vip', uid], queryFn: ({ signal }) => loadVipOverview(signal), enabled: Boolean(uid), retry: false, staleTime: 15000 });
  if (isPending) return <section className="my-account"><LoadingState label={t('copy.loadingProfile')}/></section>;
  if (!data) return <section className="my-account"><NetworkError disabled={isFetching} onRetry={()=>void refetch()}/></section>;
  return <section className="my-account" aria-label={t('copy.myAccountDetails')}>
    <div className="account-identity">
      <img src={`/assets/profile/avatar/${data.avatarId}.png`} alt={t('copy.valueSAvatar', {p0: data.nickname})} width={52} height={52} />
      <div className="account-identity-text"><div className="account-name-row"><h1 title={data.nickname}>{data.nickname}</h1>{vip.data ? <span className="account-vip-badge" aria-label={t('copy.vipLevelValue', {p0: vip.data.level})}><Icon name="crown" size={12} />VIP{vip.data.level}</span> : <button type="button" className="account-vip-badge" disabled={vip.isPending || vip.isFetching} onClick={() => void vip.refetch()} aria-label={t('copy.reloadVipLevel')}>{vip.isError ? t('copy.retryVip') : 'VIP…'}</button>}</div><p>{t('common.idLabel')}{data.uid}</p></div>
      <button type="button" className="account-settings" aria-label={t('copy.settings')} onClick={onSettings??onAction}><Icon name="settings" size={21} /></button>
      <button type="button" className="account-settings" aria-label={t('copy.messages')} onClick={onAction}><Icon name="mail" size={21} /></button>
    </div>
    <div className="account-balance-card">
      <div><span className="account-caption">{t('copy.walletBalance')}</span><WalletBalance coins={data.coins} isFetching={isFetching} onRefresh={refetch} /></div>
      <div className="account-money-actions"><button type="button" onClick={onDeposit}>{t('copy.deposit')}</button><button type="button" onClick={onWithdraw ?? onAction}>{t('copy.withdraw')}</button></div>
    </div>
    {isError && <p role="alert" className="account-refresh-error">{t('copy.balanceRefreshFailedPleaseRetry')}</p>}
    <section className="account-card"><div className="account-section-heading"><h2>{t('copy.benefitsCenter')}</h2><span>{t('copy.discoverYourBenefits')}</span></div><ActionGrid items={benefits()} label={t('copy.benefitsShortcuts')} onAction={onBenefits ?? onAction} /></section>
    <section className="account-card"><div className="account-section-heading"><h2>{t('copy.accountServices')}</h2></div><ActionGrid items={management()} label={t('copy.accountManagementShortcuts')} onAction={name => { if(name === 'wallet' && onWallet) onWallet(); else if(name === 'agent' && onAgent) onAgent(); else if(name === 'invite' && onInvite) onInvite(); else if (name === 'report' && onReport) onReport(); else if (name === 'ledger' && onLedger) onLedger(); else if (name === 'bets' && onBetRecords) onBetRecords(); else if (name === 'records') onRecords(); else onAction(); }} /></section>
    <section className="account-card account-help" aria-label={t('copy.helpAndSecurity')}>{[t('copy.securityCenter'), t('copy.aboutUs'), t('copy.faq')].map((name, index) => <button type="button" key={name} onClick={onAction}><span className="account-help-icon" aria-hidden="true"><Icon name={(['shield','info','help'] as const)[index]} size={17} /></span><span>{name}</span><span aria-hidden="true"><Icon name="chevron" size={16} /></span></button>)}<LanguageSelector /></section>
  </section>;
}
