import {ClaimBadge} from '../rewards/ClaimBadge';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import { navigateLobby } from '../../app/useLobbyRoute';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingState } from '../../components/feedback/LoadingState';
import { NetworkError } from '../../components/feedback/NetworkError';
import { t } from '../../i18n';
import { fetchLossReturn, claimLossReturn, type LossReturnInfo } from '../../services/loss-return';
import { useSessionStore } from '../../stores/session';
import { betMoney } from '../bet-records/money';
import { useClaimToast } from '../rewards/useClaimToast';
import { RebateForecast } from './RebateForecast';

export function LossReturn() {
 const uid=useSessionStore(state=>state.session?.uid),client=useQueryClient();
 const {notify,holder}=useClaimToast();
 const key=['lobby','loss-return',uid] as const;
 const query=useQuery({queryKey:key,queryFn:({signal})=>fetchLossReturn(signal),retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 const claim=useMutation({meta:{claimUid:uid,claimIndicator:'loss'},mutationFn:claimLossReturn,retry:false,onSuccess:()=>{
  notify();client.setQueryData<LossReturnInfo>(key,previous=>previous?{...previous,claimable:0}:previous);
  for(const queryKey of [['lobby','current-profile'],['wallet-ledger'],['personal-report']])void client.invalidateQueries({queryKey});
 }});
 const info=query.data;
 return <article className="rebate-card loss-return-card" aria-label={t('loss.title')}>
  {holder}<header><h2>{t('loss.title')}</h2><button type="button" onClick={()=>navigateLobby('loss-return-rules')}>{t('copy.viewRules')}</button></header>
  {query.isError&&<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>}
  {query.isPending?<LoadingState compact label={t('copy.loading')}/>:info&&<>
   <div className="rebate-claim-row"><span>{t('loss.claimable')} <strong>{betMoney(info.claimable)}</strong></span><AsyncButton loading={claim.isPending} type="button" aria-busy={claim.isPending} disabled={claim.isPending||query.isFetching||query.isError||info.claimable===0} onClick={()=>claim.mutate(info.activityDate)}>{t('copy.claim')}<ClaimBadge active={info.claimable>0}/></AsyncButton></div>
   <RebateForecast items={[{id:'loss',label:t('loss.today'),amount:info.loss},{id:'reward',label:t('copy.availableTomorrow'),amount:info.reward}]}/>
   <div className="rebate-platforms"><div><span>{t('loss.rate')}</span><strong>{info.rateBps/100}%</strong></div></div>
   {claim.isError&&<p role="alert" className="rebate-error">{claim.error.message}</p>}
  </>}
 </article>;
}
