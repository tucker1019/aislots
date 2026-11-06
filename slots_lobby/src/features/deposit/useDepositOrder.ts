import { t } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { createRecharge,fetchRechargeOrder } from '../../services/recharge';
import { readIntent,saveIntent } from './intent';
import type { DepositIntent } from './intent';
/** Shared query key keeps a manual submission and background tracking deduplicated. */
export function depositOrderQuery(uid:number,intent:DepositIntent|null){
 return {queryKey:['deposit-tracking',uid,intent?.requestId],queryFn:async({signal}:{signal:AbortSignal})=>{
  const current=readIntent(uid);
  if(!current||current.requestId!==intent?.requestId)throw new Error(t('copy.orderHasChanged'));
  let orderId=current.orderId;
  if(!orderId){const receipt=await createRecharge(current.tierId,current.requestId,uid);orderId=receipt.orderId;if(readIntent(uid)?.requestId===current.requestId)saveIntent(uid,{...current,orderId});}
  return fetchRechargeOrder(orderId,signal,uid);
 }};
}
export function useDepositOrder(uid:number,intent:DepositIntent|null){
 return useQuery({...depositOrderQuery(uid,intent),enabled:uid>0&&!!intent,
  retry:false,refetchOnMount:false,refetchOnWindowFocus:true,refetchOnReconnect:true,
  refetchInterval:query=>query.state.data?.status==='success'||query.state.data?.status==='failed'?false:query.state.status==='error'?5000:1000,
 });
}
