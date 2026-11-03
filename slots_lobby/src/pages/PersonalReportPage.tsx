import {NetworkError} from '../components/feedback/NetworkError';
import { t, serverText } from '../i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { useSessionStore } from '../stores/session';
import { fetchPersonalReport, reportPeriods, type ReportPeriod } from '../services/personal-report';
import { betMoney } from '../features/bet-records/money';
export function PersonalReportPage({onBack}:{onBack:()=>void}){
 const [period,setPeriod]=useState<ReportPeriod>('today');
 const uid=useSessionStore(state=>state.session?.uid);
 const query=useQuery({queryKey:['personal-report',uid,period],queryFn:({signal})=>fetchPersonalReport(period,signal),retry:false,staleTime:0,refetchOnWindowFocus:true,refetchOnReconnect:false});
 return <RecordsLayout title={t('copy.personalReport')} backLabel={t('copy.backToMyAccount')} onBack={onBack} className="personal-report-page" filters={<nav className="report-periods" aria-label={t('copy.reportPeriod')}>{(Object.keys(reportPeriods()) as ReportPeriod[]).map(value=><button type="button" key={value} aria-pressed={value===period} onClick={()=>{setPeriod(value);document.getElementById('root')?.scrollTo({top:0});}}>{reportPeriods()[value]}</button>)}</nav>}>
 {query.isPending?<p className="cash-records-feedback" role="status">{t('copy.loadingPersonalReport')}</p>:query.isError&&!query.data?<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>:query.data&&<>
 <dl className="report-metrics">{query.data.items.map(row=><div key={row.key} className={`report-metric${row.key==='netProfit'?' report-net':''}`}><dt>{serverText(row.label)}{t('copy.yuan')}</dt><dd className={['netProfit','gameProfit'].includes(row.key)?row.amount<0?'report-negative':'report-positive':undefined}>{row.supported?betMoney(row.amount):'—'}</dd>{row.key==='netProfit'&&<p>{t('copy.netProfitGameProfitClaimedRebatesCredited')}</p>}</div>)}</dl>
 <p className="report-note">{t('copy.depositsCountPrincipalOnlyDepositsAndWithdrawals')}</p>
 <p className="report-note">{t('copy.statisticsTimezone')}{query.data.timezone} {t('copy.unitYuanUnavailableFeaturesShowSupportedMetrics')}</p>
 <p className="report-updating" role="status">{query.isFetching?t('copy.updatingReport'):t('copy.basedOnActualActivityAndCreditTimes')}</p>
 {query.isError&&<p role="alert" className="report-note">{t('copy.updateFailedExistingDataIsPreserved')}<button type="button" onClick={()=>void query.refetch()}>{t('copy.retry')}</button></p>}
 </>}
 </RecordsLayout>;
}
