import { useQuery } from '@tanstack/react-query';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { LoadingState } from '../components/feedback/LoadingState';
import { NetworkError } from '../components/feedback/NetworkError';
import { RebateForecast } from '../features/earn/RebateForecast';
import { fetchLossReturn } from '../services/loss-return';
import { useSessionStore } from '../stores/session';
import { t } from '../i18n';

function rewardLabel(category:string):string {
 switch(category) {
  case 'rebate': return t('loss.rewardRebate');
  case 'checkin': return t('loss.rewardCheckin');
  case 'vipUpgrade': return t('loss.rewardVipUpgrade');
  case 'vipWeekly': return t('loss.rewardVipWeekly');
  case 'vipMonthly': return t('loss.rewardVipMonthly');
  case 'lossReturn': return t('loss.rewardLossReturn');
  case 'rechargeBonus': return t('loss.rewardRechargeBonus');
  case 'withdrawalBonus': return t('loss.rewardWithdrawalBonus');
  case 'newbieReward': return t('loss.rewardNewbie');
  case 'agentCommission': return t('loss.rewardAgent');
  case 'inviteReward': return t('loss.rewardInvite');
  default: return category;
 }
}
export function LossReturnRulesPage({onBack}:{onBack:()=>void}) {
 const uid=useSessionStore(state=>state.session?.uid);
 const query=useQuery({queryKey:['lobby','loss-return',uid],queryFn:({signal})=>fetchLossReturn(signal),retry:false,refetchOnWindowFocus:true,refetchInterval:query=>query.state.error?false:5000,refetchOnReconnect:false});
 const info=query.data;
 const hasPlatformFee=(info?.platformFeeRateBps??0)>0;
 return <RecordsLayout title={t('loss.rulesTitle')} backLabel={t('copy.backToEarn')} onBack={onBack}>
  {query.isError&&<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>}
  {query.isPending?<LoadingState label={t('copy.loading')}/>:info&&<div className="rebate-rules-page">
   <RebateForecast items={[{id:'claimable',label:t('loss.claimable'),amount:info.claimable},{id:'loss',label:t('loss.today'),amount:info.loss},{id:'preview',label:t('copy.availableTomorrow'),amount:info.reward}]}/>
   <div className="rebate-platforms"><div><span>{t('loss.rate')}</span><strong>{info.rateBps/100}%</strong></div></div>
   <section className="rebate-rule-description"><h2>{t('copy.rules')}</h2><ol>
    <li>{hasPlatformFee?t('loss.formula'):t('loss.formulaWithoutFee')}</li>{hasPlatformFee&&<li>{t('loss.platformFee')} {(info.platformFeeRateBps??0)/100}%</li>}<li>{t('loss.includedRewards')} {(info.rewardCategories??[]).map(category=>rewardLabel(category)).join('、')||t('loss.noRewards')}</li><li>{t('loss.window')}</li><li>{t('loss.exclusions')}</li><li>{t('loss.preview')}</li><li>{t('loss.turnover')}</li>
   </ol></section>
  </div>}
 </RecordsLayout>;
}
