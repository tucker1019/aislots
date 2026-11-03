import {useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Icon} from '../../components/Icon';
import {navigateLobby} from '../../app/useLobbyRoute';
import {useSessionStore} from '../../stores/session';
import {fetchInviteChests,claimInviteChest} from '../../services/invite-details';
import {betMoney} from '../bet-records/money';
import {useClaimToast} from '../rewards/useClaimToast';
import {t} from '../../i18n';
export function InviteChests(){
 const uid=useSessionStore(s=>s.session?.uid);const [page,setPage]=useState(1);const client=useQueryClient();const requests=useRef(new Map<string,string>());
 const {notify,holder,toast}=useClaimToast();
 const query=useQuery({queryKey:['invite-chests',uid,page],queryFn:({signal})=>fetchInviteChests(page,signal),retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 // Retain the same request ID after a lost response so a retry cannot credit twice.
 const claim=useMutation({mutationFn:async(rewardId:string)=>{let id=requests.current.get(rewardId);if(!id){id=crypto.randomUUID();requests.current.set(rewardId,id);}return claimInviteChest(rewardId,id);},retry:false,onSuccess:()=>{notify();void client.invalidateQueries({queryKey:['invite-chests']});void client.invalidateQueries({queryKey:['invite']});void client.invalidateQueries({queryKey:['lobby','current-profile']});void client.invalidateQueries({queryKey:['wallet-ledger']});}});
 const data=query.data;
 async function copy(){if(!data)return;try{await navigator.clipboard.writeText(data.info.inviteUrl);void toast.success(t('invite.linkCopied'));}catch{void toast.error(t('invite.copyFailed'));}}
 return <>{holder}<section className="earn-invite" aria-label={t('copy.inviteFriends')}>
 {query.isPending?<p role="status">{t('invite.loading')}</p>:!data?<div role="alert"><p>{t('invite.loadFailed')}</p><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t('copy.retry')}</button></div>:<>
 <div className="earn-invite-summary"><span>{t('invite.memberSummary',{count:data.info.invitedCount,qualified:data.info.qualifiedCount})}</span><button type="button" onClick={()=>navigateLobby('invite-friends')}>{t('invite.friends')} ›</button></div>
 <div className="invite-card invite-link"><label htmlFor="earn-invite-link">{t('invite.link')}</label><input id="earn-invite-link" readOnly value={data.info.inviteUrl}/><button type="button" onClick={()=>void copy()}>{t('copy.copy')}</button></div>
 <header className="earn-invite-heading"><h2>{t('copy.inviteFriends')}</h2><button type="button" onClick={()=>navigateLobby('invite')}>{t('copy.viewRules')}</button></header>
 <p className="invite-deadline-note">{t('invite.deadlineNote',{days:data.info.rules.durationDays})}</p><div className="invite-chest-scroll"><div className="invite-chest-grid">{data.items.map(item=><button key={item.slot} type="button" className={`invite-chest is-${item.status}`} disabled={item.status!=='claimable'||claim.isPending||query.isFetching} aria-label={t('invite.chestLabel',{slot:item.slot,status:t(`invite.chest.${item.status}`)})} onClick={()=>claim.mutate(item.rewardId)}><Icon name="chest" size={34}/><span>{t('invite.chestNumber',{slot:item.slot})}</span><strong>{betMoney(item.amount)}</strong><small>{claim.isPending&&claim.variables===item.rewardId?t('copy.claiming'):t(`invite.chest.${item.status}`)}</small></button>)}</div></div>
 {claim.isError&&<p role="alert">{claim.error.message}</p>}
 {(page>1||data.hasMore)&&<nav className="invite-pagination" aria-label={t('invite.chestPages')}><button type="button" disabled={page<=1||claim.isPending} onClick={()=>setPage(p=>p-1)}>{t('invite.previous')}</button><span>{page}</span><button type="button" disabled={!data.hasMore||claim.isPending} onClick={()=>setPage(p=>p+1)}>{t('invite.next')}</button></nav>}
 </>}
 </section></>;
}
