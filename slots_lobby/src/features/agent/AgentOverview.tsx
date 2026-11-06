import {ClaimBadge} from '../rewards/ClaimBadge';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import {Icon, type IconName} from '../../components/Icon';
import {AgentMetrics} from './AgentMetrics';
import {t} from '../../i18n';
import {betMoney} from '../bet-records/money';
import type {AgentData,AgentView} from '../../services/agent';
export function AgentOverview({data,navigate,onClaim,pending,onCopy}:{data:AgentData;navigate:(view:AgentView)=>void;onClaim:()=>void;pending:boolean;onCopy:(success:boolean)=>void}){
 const s=data.summary;
 return <div className="agent-overview">
 <section className="agent-card"><h2>{t('agent.myCommission')}</h2><AgentMetrics summary={s} keys={["commission","directCommission","otherCommission"]}/>
 <div className="agent-claim"><div><h2>{t('agent.claimable')}</h2><strong>{betMoney(s.claimable)}</strong></div><AsyncButton loading={pending} type="button" disabled={pending||s.claimable<=0} aria-busy={pending} onClick={onClaim}>{t('agent.claim')}<ClaimBadge active={s.claimable>0}/></AsyncButton></div></section>
 <section className="agent-card"><header><h2>{t('agent.myTeam')}</h2><button type="button" onClick={()=>navigate('team')}>{t('agent.more')} ›</button></header><AgentMetrics summary={s} keys={["teamCount","directCount","otherCount","newCount"]}/></section>
 <nav className="agent-links">{(['performance','report','rates','records','rules'] as const).map(v=><button type="button" key={v} onClick={()=>navigate(v)}><span className={`agent-link-icon agent-link-icon-${v}`}><Icon name={({performance:'growth',report:'report',rates:'coin',records:'list',rules:'info'} satisfies Record<string,IconName>)[v]} size={26}/></span><span>{t(`agent.${v}`)}</span></button>)}</nav>
 <section className="agent-card"><h2>{t('agent.inviteLink')}</h2><div className="agent-invite"><input aria-label={t('agent.inviteLink')} readOnly value={data.inviteUrl}/><button type="button" onClick={()=>{void navigator.clipboard.writeText(data.inviteUrl).then(()=>onCopy(true)).catch(()=>onCopy(false));}}>{t('agent.copy')}</button></div></section>
 </div>;
}
