import { t } from '../i18n';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { RebateRules } from '../features/earn/RebateRules';
import { useRebate } from '../features/earn/useRebate';
export function RebateRulesPage({onBack}:{onBack:()=>void}) {
 const query=useRebate();
 return <RecordsLayout title={t('copy.rebateRules')} backLabel={t('copy.backToEarn')} onBack={onBack}>
  {query.isPending?<p className="rebate-feedback" role="status">{t('copy.loadingRebateRules')}</p>:!query.data?<div className="rebate-feedback" role="alert"><p>{t('copy.rebateRulesFailedToLoad')}</p><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t('copy.retry')}</button></div>:<RebateRules info={query.data}/>}
 </RecordsLayout>;
}
