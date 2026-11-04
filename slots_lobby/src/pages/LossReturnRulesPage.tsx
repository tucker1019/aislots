import { useQuery } from '@tanstack/react-query';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { LoadingState } from '../components/feedback/LoadingState';
import { NetworkError } from '../components/feedback/NetworkError';
import { RebateForecast } from '../features/earn/RebateForecast';
import { fetchLossReturn } from '../services/loss-return';
import { useSessionStore } from '../stores/session';
import { t } from '../i18n';

export function LossReturnRulesPage({onBack}:{onBack:()=>void}) {
 const uid=useSessionStore(state=>state.session?.uid);
 const query=useQuery({queryKey:['lobby','loss-return',uid],queryFn:({signal})=>fetchLossReturn(signal),retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const info=query.data;
 return <RecordsLayout title={t('loss.rulesTitle')} backLabel={t('copy.backToEarn')} onBack={onBack}>
  {query.isError&&<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>}
  {query.isPending?<LoadingState label={t('copy.loading')}/>:info&&<div className="rebate-rules-page">
   <RebateForecast items={[{id:'claimable',label:t('loss.claimable'),amount:info.claimable},{id:'loss',label:t('loss.today'),amount:info.loss},{id:'preview',label:t('copy.availableTomorrow'),amount:info.reward}]}/>
   <div className="rebate-platforms"><div><span>{t('loss.rate')}</span><strong>{info.rateBps/100}%</strong></div></div>
   <section className="rebate-rule-description"><h2>{t('copy.rules')}</h2><ol>
    <li>{t('loss.formula')}</li><li>{t('loss.window')}</li><li>{t('loss.exclusions')}</li><li>{t('loss.preview')}</li><li>{t('loss.turnover')}</li>
    <li>{t('copy.activityTimezone')} {info.timezone}</li>
   </ol></section>
  </div>}
 </RecordsLayout>;
}
