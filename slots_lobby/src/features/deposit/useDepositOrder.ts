import { useQuery } from '@tanstack/react-query';
import { createRecharge,fetchRechargeOrder } from '../../services/recharge';
import { readIntent,saveIntent } from './intent';
import type { DepositIntent } from './intent';
export function useDepositOrder(uid:number,intent:DepositIntent|null){
 return useQuery({queryKey:['deposit-tracking',uid,intent?.requestId],enabled:uid>0&&!!intent,
  queryFn:async({signal})=>{
   const current=readIntent(uid);
   if(!current||current.requestId!==intent?.requestId)throw new Error('订单已变化');
   let orderId=current.orderId;
   if(!orderId){const receipt=await createRecharge(current.tierId,current.requestId,uid);orderId=receipt.orderId;if(readIntent(uid)?.requestId===current.requestId)saveIntent(uid,{...current,orderId});}
   return fetchRechargeOrder(orderId,signal,uid);
  },retry:false,refetchOnMount:false,refetchOnWindowFocus:true,refetchOnReconnect:true,
  refetchInterval:query=>query.state.data?.status==='success'||query.state.data?.status==='failed'?false:query.state.status==='error'?5000:1000,
 });
}
