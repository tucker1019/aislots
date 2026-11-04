import {LoadingState} from '../components/feedback/LoadingState';
import {NetworkError} from '../components/feedback/NetworkError';
import {useQuery} from '@tanstack/react-query';
import {message} from 'antd';
import {RecordsLayout} from '../components/records/RecordsLayout';
import {Icon} from '../components/Icon';
import {useSessionStore} from '../stores/session';
import {fetchInviteInfo} from '../services/invite';
import {betMoney} from '../features/bet-records/money';
import {t} from '../i18n';
export function InvitePage({onBack}:{onBack:()=>void}){
 const uid=useSessionStore(state=>state.session?.uid);
 const [toast,holder]=message.useMessage({maxCount:1,classNames:{list:'lobby-toast-list'}});
 const query=useQuery({queryKey:['invite',uid],queryFn:({signal})=>fetchInviteInfo(signal),retry:false,staleTime:0,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const info=query.data;
 async function copy(){if(!info)return;try{await navigator.clipboard.writeText(info.inviteUrl);void toast.success(t('invite.linkCopied'));}catch{void toast.error(t('invite.copyFailed'));}}
 return <>{holder}<RecordsLayout title={t('copy.inviteFriends')} backLabel={t('copy.backToMyAccount')} onBack={onBack} className="invite-page">
 {query.isPending?<LoadingState label={t('invite.loading')}/>:!info?<NetworkError onRetry={()=>void query.refetch()} disabled={query.isFetching}/>:<>
 <section className="invite-card invite-table-wrap"><table><thead><tr><th>{t('invite.effectiveMembers')}</th><th>{t('invite.rewardAmount')}</th></tr></thead><tbody>{Array.from({length:info.rules.displayRows},(_,i)=><tr key={i}><td>≥{i+1}</td><td>{betMoney((i+1)*info.rules.rewardAmount)}</td></tr>)}</tbody></table></section>
 <section className="invite-card invite-link"><label htmlFor="invite-link">{t('invite.link')}</label><input id="invite-link" readOnly value={info.inviteUrl} onFocus={event=>event.currentTarget.select()}/><button type="button" onClick={()=>void copy()}>{t('copy.copy')}</button></section>
 <a className="invite-card invite-support-card" href={info.supportUrl} target="_blank" rel="noopener noreferrer" aria-label={t('invite.support')}><span className="invite-support-icon"><Icon name="help" size={28}/></span><strong>{t('invite.support')}</strong><Icon name="chevron" size={18}/></a>
 <section className="invite-card invite-rules"><h2>{t('invite.rules')}</h2><ol><li>{t('invite.ruleThresholds',{days:info.rules.durationDays,count:info.rules.minDepositCount,deposit:betMoney(info.rules.minDepositAmount),bet:betMoney(info.rules.minBetAmount),reward:betMoney(info.rules.rewardAmount)})}</li><li>{t('invite.ruleBinding')}</li><li>{t('invite.ruleClaim')}</li><li>{t('invite.ruleConfig')}</li></ol></section>
 </>}
 </RecordsLayout></>;
}
