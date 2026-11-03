import {NetworkError} from '../components/feedback/NetworkError';
import { t } from '../i18n';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { RebateRules } from '../features/earn/RebateRules';
import { useRebate } from '../features/earn/useRebate';
export function RebateRulesPage({onBack}:{onBack:()=>void}) {
 const query=useRebate();
 return <RecordsLayout title={t('copy.rebateRules')} backLabel={t('copy.backToEarn')} onBack={onBack}>
  {query.isPending?<p className="rebate-feedback" role="status">{t('copy.loadingRebateRules')}</p>:!query.data?<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>:<RebateRules info={query.data}/>}
 </RecordsLayout>;
}
