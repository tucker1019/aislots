import {t} from '../../i18n';
import {betMoney} from '../bet-records/money';
import type {AgentData,AgentView,AgentRow} from '../../services/agent';
type Column={label:string;value:(r:AgentRow)=>string|number;money?:boolean};
export function AgentTable({view,kind,data,onMember,onProvider}:{view:AgentView;kind:string;data:AgentData;onMember:(uid:number)=>void;onProvider:(p:string)=>void}){
 const account:Column={label:t('agent.account'),value:r=>r.account};const depth:Column={label:t('agent.depth'),value:r=>r.depth};
 const money=(key:'validBet'|'teamBet'|'commission'|'profit'|'amount'):Column=>({label:t(`agent.${key}`),value:r=>betMoney(r[key]),money:true});
 let columns:Column[]=[];
 if(view==='team')columns=[{label:t('agent.uid'),value:r=>r.uid},account,{label:t('agent.registeredAt'),value:r=>r.registeredAt}, {label:t('agent.children'),value:r=>r.children}];
 else if(view==='performance')columns=[{label:t('agent.provider'),value:r=>r.provider},money('validBet'),money('commission')];
 else if(view==='performance-details')columns=[{label:t('agent.uid'),value:r=>r.uid},account,money('validBet'),money('commission')];
 else if(view==='rates')columns=[{label:t('agent.provider'),value:r=>r.provider},{label:t('agent.threshold'),value:r=>betMoney(r.threshold)},{label:t('agent.perTenThousand'),value:r=>r.perTenThousand}];
 else if(view==='records')columns=[{label:t('agent.claimId'),value:r=>r.claimId},{label:t('agent.createdAt'),value:r=>r.createdAt},money('amount')];
 else if(kind==='team')columns=[account,{label:t('agent.registeredAt'),value:r=>r.registeredAt},money('validBet'),money('teamBet')];
 else if(kind==='bets')columns=[account,depth,money('validBet'),money('profit')];
 else if(kind==='first-deposit')columns=[account,depth,{label:t('agent.paymentType'),value:()=>t('agent.testPayment')},money('amount')];
 else columns=[account,depth,money('amount')];
 return <div className="agent-table-scroll"><table className="agent-table"><thead><tr>{columns.map(c=><th key={c.label}>{c.label}</th>)}{(view==='team'||view==='performance')&&<th aria-label={t('agent.detail')}/>}</tr></thead><tbody>{data.items.length?data.items.map((r,i)=><tr key={`${r.uid}-${r.provider}-${i}`}>{columns.map(c=><td key={c.label} className={c.money?'agent-money-cell':undefined}>{c.value(r)}</td>)}{view==='team'&&<td><button type="button" aria-label={`${t('agent.children')} ${r.account}`} onClick={()=>onMember(r.uid)}>›</button></td>}{view==='performance'&&<td><button type="button" aria-label={`${t('agent.detail')} ${r.provider}`} onClick={()=>onProvider(r.provider)}>›</button></td>}</tr>):<tr><td className="agent-empty" colSpan={columns.length+((view==='team'||view==='performance')?1:0)}>{t('agent.empty')}</td></tr>}</tbody></table></div>;
}
