import { overlayContainer } from '../app/designViewport';
import {LoadingState} from '../components/feedback/LoadingState';
import {NetworkError} from '../components/feedback/NetworkError';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Modal} from 'antd';
import {RecordsLayout} from '../components/records/RecordsLayout';
import {fetchInviteFriends,type InviteFriend} from '../services/invite-details';
import {useSessionStore} from '../stores/session';
import {betMoney} from '../features/bet-records/money';
import {getLocale,t} from '../i18n';
export function InviteFriendsPage({onBack}:{onBack:()=>void}){
 const uid=useSessionStore(s=>s.session?.uid);const [page,setPage]=useState(1);const [selected,setSelected]=useState<InviteFriend|null>(null);
 const query=useQuery({queryKey:['invite-friends',uid,page],queryFn:({signal})=>fetchInviteFriends(page,signal),retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const data=query.data;
 function reason(friend:InviteFriend,code:InviteFriend['reasons'][number]){if(code==='payout_account')return t('invite.reason.payout_account');const count=code==='deposit_count';return t(`invite.reason.${code}`,{days:friend.durationDays,current:count?friend.depositCount:betMoney(code==='deposit_amount'?friend.depositAmount:friend.betAmount),required:count?friend.requiredDepositCount:betMoney(code==='deposit_amount'?friend.requiredDepositAmount:friend.requiredBetAmount)});}
 return <RecordsLayout title={t('invite.friends')} backLabel={t('invite.backEarn')} onBack={onBack} className="invite-friends-page">
 {query.isPending?<LoadingState label={t('invite.loading')}/>:!data?<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>:<>
 <div className="invite-friends-table"><table><thead><tr>{(['registered','account','deposit','bet','qualified','details'] as const).map(key=><th key={key}>{t(`invite.column.${key}`)}</th>)}</tr></thead><tbody>{data.items.map(friend=><tr key={friend.uid}><td>{new Date(friend.registeredAt).toLocaleString(getLocale(),{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}</td><td>{friend.account}</td><td>{betMoney(friend.depositAmount)}</td><td>{betMoney(friend.betAmount)}</td><td className={friend.qualified?'is-qualified':'is-unqualified'}>{friend.qualified?t('invite.yes'):t('invite.no')}</td><td>{friend.qualified?'—':<button type="button" onClick={()=>setSelected(friend)}>{t('invite.view')}</button>}</td></tr>)}</tbody></table></div>
 {data.items.length===0&&<p className="cash-records-feedback">{t('invite.noFriends')}</p>}
 <nav className="invite-pagination" aria-label={t('invite.friendPages')}><button type="button" disabled={page===1} onClick={()=>setPage(p=>p-1)}>{t('invite.previous')}</button><span>{page}</span><button type="button" disabled={!data.hasMore} onClick={()=>setPage(p=>p+1)}>{t('invite.next')}</button></nav>
 </>}
 <Modal getContainer={overlayContainer} open={selected!==null} centered width={400} title={null} footer={null} closable={false} onCancel={()=>setSelected(null)} className="vip-upgrade-modal invite-reason-modal" destroyOnHidden>
  <section className="vip-upgrade-panel" aria-label={t('invite.reasonTitle')}>
   <h2>{t('invite.reasonTitle')}</h2>
   <div className="vip-upgrade-body">
    {selected&&<ol className="invite-reasons">{selected.reasons.map(code=><li key={code}>{reason(selected,code)}</li>)}</ol>}
    <button type="button" className="vip-upgrade-home" onClick={()=>setSelected(null)}>{t('invite.understood')}</button>
   </div>
  </section>
 </Modal>
 </RecordsLayout>;
}
