import { useEffect } from 'react';
import { message } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../../stores/session';
import { clearIntent,readIntent,useDepositIntent } from './intent';
import { useDepositOrder } from './useDepositOrder';
export function DepositTracker({onSuccess}:{onSuccess?:()=>void}){
 const uid=useSessionStore(state=>state.session?.uid)??0;
 const intent=useDepositIntent(uid);const order=useDepositOrder(uid,intent);const client=useQueryClient();
 const [toast,holder]=message.useMessage({top:'calc(env(safe-area-inset-top, 0px) + 12px)',maxCount:1,classNames:{list:'lobby-toast-list'}});
 useEffect(()=>{
  const data=order.data;
  if(!intent||!data||data.status==='pending'||useSessionStore.getState().session?.uid!==uid||readIntent(uid)?.requestId!==intent.requestId)return;
  clearIntent(uid);
  if(data.status==='success'){
   void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});
   void client.invalidateQueries({queryKey:['cash-records']});
   void client.invalidateQueries({queryKey:['wallet-ledger']});
   void client.invalidateQueries({queryKey:['recharge-order',uid,data.orderId]});
   void toast.success({key:'deposit-success',content:'存款成功',duration:2});onSuccess?.();
  }else void toast.error({key:'deposit-failed',content:'存款订单未成功，请重新创建订单'});
 },[order.data,intent,uid,client,toast,onSuccess]);
 return holder;
}
