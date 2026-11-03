import {t} from '../../i18n';
import {AgentMetrics} from './AgentMetrics';
import type {AgentData} from '../../services/agent';
export function AgentReport({data,onDetail}:{data:AgentData;onDetail:(kind:string)=>void}){
 const s=data.summary;
 const groups=[{name:'team',keys:['teamCount','directCount','otherCount'],detail:true},{name:'new',keys:['newCount','directNew','otherNew'],detail:false},{name:'bets',keys:['betCount','validBet','bettorCount','profit'],detail:true},{name:'first-deposit',keys:['firstDepositCount','firstDepositAmount'],detail:true},{name:'deposit',keys:['depositCount','depositAmount'],detail:true},{name:'withdrawal',keys:['withdrawalCount','withdrawalAmount'],detail:true}] as const;
 return <div className="agent-report">{groups.map(g=><section className="agent-card" key={g.name}><header><h2>{t(`agent.group.${g.name}`)}</h2>{g.detail&&<button type="button" onClick={()=>onDetail(g.name)}>{t('agent.detail')} ›</button>}</header>{g.name==='bets'?<div className="agent-report-bets"><AgentMetrics summary={s} keys={['betCount','bettorCount']}/><AgentMetrics summary={s} keys={['validBet','profit']}/></div>:<AgentMetrics summary={s} keys={g.keys}/>}</section>)}</div>;
}
