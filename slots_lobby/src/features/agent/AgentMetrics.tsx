import {t} from '../../i18n';
import {betMoney} from '../bet-records/money';
import type {AgentSummary} from '../../services/agent';
export function AgentMetrics({summary,keys}:{summary:AgentSummary;keys:readonly (keyof AgentSummary)[]}){
 return <div className="agent-metric-scroll"><table className="agent-metric-table"><thead><tr>{keys.map(k=><th key={k}>{t(`agent.${k}`)}</th>)}</tr></thead><tbody><tr>{keys.map(k=><td key={k}>{k.endsWith('Count')||k==='directNew'||k==='otherNew'?summary[k]:betMoney(summary[k])}</td>)}</tr></tbody></table></div>;
}
