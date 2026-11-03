import {NetworkError} from '../components/feedback/NetworkError';
import {useClaimToast} from '../features/rewards/useClaimToast';
import {RecordFilterBar} from '../components/records/RecordFilterBar';
import {useRef,useState,useSyncExternalStore} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {t} from '../i18n';
import {RecordsLayout} from '../components/records/RecordsLayout';
import {useSessionStore} from '../stores/session';
import {agentDefaults,agentPeriods,claimAgent,fetchAgent,type AgentParams,type AgentPeriod,type AgentView} from '../services/agent';
import {AgentOverview} from '../features/agent/AgentOverview';
import {AgentReport} from '../features/agent/AgentReport';
import {AgentTable} from '../features/agent/AgentTable';
const views:AgentView[]=['center','team','performance','performance-details','report','report-details','rates','records','rules'];
function subscribe(listener:()=>void){window.addEventListener('popstate',listener);window.addEventListener('lobby:navigate',listener);return()=>{window.removeEventListener('popstate',listener);window.removeEventListener('lobby:navigate',listener);};}
function snapshot(){return window.location.search;}
export function AgentPage({onBack}:{onBack:()=>void}){
 const search=useSyncExternalStore(subscribe,snapshot,()=> '');const q=new URLSearchParams(search);
 const raw=q.get('view') as AgentView;const view=views.includes(raw)?raw:'center';
 const params:AgentParams={...agentDefaults,period:agentPeriods.includes(q.get('period') as AgentPeriod)?q.get('period') as AgentPeriod:'today',targetUid:Number(q.get('target'))||0,provider:q.get('provider')??'',kind:q.get('kind')??'team',scope:q.get('scope')??'all',search:q.get('search')??'',page:Math.max(1,Number(q.get('page'))||1)};
 const [input,setInput]=useState('');const uid=useSessionStore(s=>s.session?.uid);const client=useQueryClient();
 const query=useQuery({queryKey:['agent',uid,view,params],queryFn:({signal})=>fetchAgent(view==='rules'?'rates':view,params,signal),retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const requestId=useRef<string|null>(null);const {toast,holder}=useClaimToast();
 const claim=useMutation({mutationFn:()=>{requestId.current??=crypto.randomUUID();return claimAgent(requestId.current);},retry:false,onError:()=>{void toast.error(t('agent.claimFailed'));},onSuccess:()=>{requestId.current=null;void toast.success(t('agent.claimSuccess'));void client.invalidateQueries({queryKey:['agent']});void client.invalidateQueries({queryKey:['lobby','current-profile']});void client.invalidateQueries({queryKey:['wallet-ledger']});void client.invalidateQueries({queryKey:['personal-report']});}});
 function navigate(next:AgentView,patch:Partial<AgentParams>={}){
 const value={...params,...patch};const nextQuery=new URLSearchParams({view:next,period:value.period,target:String(value.targetUid),provider:value.provider,scope:value.scope,search:value.search,page:String(patch.page??1),kind:value.kind});
 window.history.pushState({agent:true},'',`/agent?${nextQuery}`);window.dispatchEvent(new Event('lobby:navigate'));document.getElementById('root')?.scrollTo({top:0});
 }
 const filtered=!['center','rules','rates','records','team'].includes(view);
 return <RecordsLayout title={view==='team'&&params.targetUid&&query.data?query.data.account:view==='report-details'?t(`agent.group.${(['team','bets','first-deposit','deposit','withdrawal'].includes(params.kind)?params.kind:'team') as 'team'|'bets'|'first-deposit'|'deposit'|'withdrawal'}`):t(`agent.${view}`)} backLabel={t('copy.backToMyAccount')} onBack={()=>{if(window.history.state?.agent)window.history.back();else if(view!=='center')navigate('center',{targetUid:0,search:''});else onBack();}} className="agent-page" filters={filtered?<RecordFilterBar filters={[
 {id:'period',label:t('agent.period'),value:params.period,options:agentPeriods.map(value=>({value,label:t(`agent.period.${value}`)})),onChange:value=>navigate(view,{period:value as AgentPeriod})},
 ...(['report-details','performance-details'].includes(view)?[{id:'scope',label:t('agent.scope'),value:params.scope,options:(['all','direct','other'] as const).map(value=>({value,label:t(`agent.scope.${value}`)})),onChange:(value:string)=>navigate(view,{scope:value})}]:[]),
 ...(view==='performance'?[{id:'provider',label:t('agent.provider'),value:params.provider,options:[{value:'',label:t('agent.scope.all')},...(query.data?.providers??[]).map(value=>({value,label:value}))],onChange:(value:string)=>navigate(view,{provider:value})}]:[])
 ]}/>:undefined}>
 {holder}
 {['team','report'].includes(view)&&<form className="agent-search" onSubmit={e=>{e.preventDefault();navigate(view,{search:input});}}><input aria-label={t('agent.search')} placeholder={t('agent.search')} value={input} onChange={e=>setInput(e.target.value)} maxLength={64}/><button type="submit">{t('agent.query')}</button>{params.search&&<button type="button" onClick={()=>{setInput('');navigate(view,{search:''});}}>{t('agent.clear')}</button>}</form>}
 {query.isPending?<p role="status">{t('copy.loading')}</p>:query.isError?<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>:query.data&&<>
 {view==='center'?<AgentOverview data={query.data} navigate={v=>navigate(v,{targetUid:0,search:''})} onClaim={()=>claim.mutate()} pending={claim.isPending} onCopy={success=>{if(success)void toast.success(t('agent.copied'));else void toast.error(t('agent.copyFailed'));}}/>:view==='report'?<AgentReport data={query.data} onDetail={kind=>navigate('report-details',{kind})}/>:view==='rules'?<section className="agent-card"><h2>{t('agent.rules')}</h2><p>{t('agent.rulesText')}</p><p>{t('agent.previewNote')}</p><AgentTable view="rates" kind="" data={query.data} onMember={()=>undefined} onProvider={()=>undefined}/></section>:<AgentTable view={view} kind={params.kind} data={query.data} onMember={targetUid=>navigate('team',{targetUid,search:''})} onProvider={provider=>navigate('performance-details',{provider})}/>}
 {!['center','report','rules','rates','performance'].includes(view)&&<nav className="agent-pagination" aria-label={t('agent.pagination')}><button type="button" disabled={params.page<=1||query.isFetching} onClick={()=>navigate(view,{page:params.page-1})}>{t('agent.previous')}</button><span>{params.page}</span><button type="button" disabled={!query.data.hasMore||query.isFetching} onClick={()=>navigate(view,{page:params.page+1})}>{t('agent.next')}</button></nav>}
 {filtered&&<p className="agent-note">{query.data.status==='preview'?t('agent.previewNote'):t('agent.settledNote')} · {query.data.timezone}</p>}
 </>}
 </RecordsLayout>;
}
