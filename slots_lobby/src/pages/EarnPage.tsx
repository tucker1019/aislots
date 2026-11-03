import {useClaimToast} from '../features/rewards/useClaimToast';
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {claimRebate} from '../services/rebate';
import {useSessionStore} from '../stores/session';
import {betMoney} from '../features/bet-records/money';
import {useRebate} from '../features/earn/useRebate';
import {navigateLobby} from '../app/useLobbyRoute';
export function EarnPage(){
 const uid=useSessionStore(state=>state.session?.uid);const client=useQueryClient();const [success,setSuccess]=useState<number|null>(null);
 const {notify,holder}=useClaimToast();
 const query=useRebate();
 const claim=useMutation({mutationFn:claimRebate,retry:false,onSuccess:reward=>{notify();setSuccess(reward);client.setQueryData(['lobby','rebate',uid],query.data?{...query.data,claimableTotal:0}:undefined);void client.invalidateQueries({queryKey:['lobby','current-profile']});void client.invalidateQueries({queryKey:['wallet-ledger']});}});
 const info=query.data;
 return <>{holder}<section className="earn-page" aria-label="赚钱"><h1>赚钱</h1><article className="rebate-card"><header><h2>反水金额</h2><button type="button" disabled={!info} onClick={()=>navigateLobby('earn-rules')}>规则查看 ›</button></header>
 {query.isPending?<p className="rebate-feedback" role="status">正在加载反水信息…</p>:!info?<div className="rebate-feedback" role="alert"><p>反水信息加载失败</p><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>重试</button></div>:<>
 <div className="rebate-claim-row"><span>可领取反水 <strong>{betMoney(info.claimableTotal)}</strong></span><button type="button" disabled={claim.isPending||query.isFetching||info.claimableTotal===0} onClick={()=>claim.mutate(info.activityDate)}>{claim.isPending?'领取中…':'领取'}</button></div>
 <div className="rebate-preview">{([{key:'daily',label:'明日可领'},{key:'weekly',label:'下周一可领'},{key:'monthly',label:'下月1号可领'}] as const).map(item=><div key={item.key}><span>{item.label}</span><strong>{betMoney(info[item.key].reward)}</strong></div>)}</div>
 <div className="rebate-platforms" aria-label="平台反水比例">{info.platforms.length?info.platforms.map(p=><div key={p.name}><span>{p.name}</span><strong>{(p.dailyRateBps+p.weeklyRateBps+p.monthlyRateBps)/100}%</strong></div>):<p>暂无开放平台</p>}</div>
 {claim.isError&&<p className="rebate-error" role="alert">{claim.error.message}</p>}{success!==null&&<p className="rebate-success" role="status">领取成功，获得 {betMoney(success)}</p>}
 <p className="rebate-note">预估金额以周期结算为准，平台比例为日、周、月反水比例之和。</p>
 </>}
 </article></section></>;
}
