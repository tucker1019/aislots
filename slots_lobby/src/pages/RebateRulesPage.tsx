import { RecordsLayout } from '../components/records/RecordsLayout';
import { RebateRules } from '../features/earn/RebateRules';
import { useRebate } from '../features/earn/useRebate';
export function RebateRulesPage({onBack}:{onBack:()=>void}) {
 const query=useRebate();
 return <RecordsLayout title="反水规则" backLabel="返回赚钱" onBack={onBack}>
  {query.isPending?<p className="rebate-feedback" role="status">正在加载反水规则…</p>:!query.data?<div className="rebate-feedback" role="alert"><p>反水规则加载失败</p><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>重试</button></div>:<RebateRules info={query.data}/>}
 </RecordsLayout>;
}
