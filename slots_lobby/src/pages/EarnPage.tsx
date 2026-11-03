import {RebateForecast} from '../features/earn/RebateForecast';
import {InviteChests} from '../features/invite/InviteChests';
import { t } from '../i18n';
import {useClaimToast} from '../features/rewards/useClaimToast';
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {claimRebate} from '../services/rebate';
import {useSessionStore} from '../stores/session';
import {betMoney} from '../features/bet-records/money';
import {useRebate} from '../features/earn/useRebate';
import {navigateLobby} from '../app/useLobbyRoute';
export function EarnPage(){
 const uid=useSessionStore(state=>state.session?.uid);const client=useQueryClient();const [success,setSuccess]=useState<number|null>(null);
 const {notify,holder}=useClaimToast();
 const query=useRebate();
 const claim=useMutation({mutationFn:claimRebate,retry:false,onSuccess:reward=>{notify();setSuccess(reward);client.setQueryData(['lobby','rebate',uid],query.data?{...query.data,claimableTotal:0}:undefined);void client.invalidateQueries({queryKey:['lobby','current-profile']});void client.invalidateQueries({queryKey:['wallet-ledger']});}});
 const info=query.data;
 return <>{holder}<section className="earn-page" aria-label={t('copy.earn')}><h1>{t('copy.earn')}</h1><InviteChests/><article className="rebate-card"><header><h2>{t('copy.rebateAmount')}</h2><button type="button" disabled={!info} onClick={()=>navigateLobby('earn-rules')}>{t('copy.viewRules')}</button></header>
 {query.isPending?<p className="rebate-feedback" role="status">{t('copy.loadingRebateInformation')}</p>:!info?<div className="rebate-feedback" role="alert"><p>{t('copy.rebateInformationFailedToLoad')}</p><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t('copy.retry')}</button></div>:<>
 <div className="rebate-claim-row"><span>{t('copy.claimableRebate')} <strong>{betMoney(info.claimableTotal)}</strong></span><button type="button" disabled={claim.isPending||query.isFetching||info.claimableTotal===0} onClick={()=>claim.mutate(info.activityDate)}>{claim.isPending?t('copy.claiming'):t('copy.claim')}</button></div>
 <RebateForecast items={([{key:'daily',label:t('copy.availableTomorrow')},{key:'weekly',label:t('copy.availableNextMonday')},{key:'monthly',label:t('copy.availableOnThe1StOfNextMonth')}] as const).map(item=>({id:item.key,label:item.label,amount:info[item.key].reward}))}/>
 <div className="rebate-platforms" aria-label={t('copy.providerRebateRates')}>{info.platforms.length?info.platforms.map(p=><div key={p.name}><span>{p.name}</span><strong>{(p.dailyRateBps+p.weeklyRateBps+p.monthlyRateBps)/100}%</strong></div>):<p>{t('copy.noProvidersAvailable')}</p>}</div>
 {claim.isError&&<p className="rebate-error" role="alert">{claim.error.message}</p>}{success!==null&&<p className="rebate-success" role="status">{t('copy.claimSuccessfulReward')} {betMoney(success)}</p>}
 <p className="rebate-note">{t('copy.estimatesDependOnPeriodSettlementProviderRates')}</p>
 </>}
 </article></section></>;
}
