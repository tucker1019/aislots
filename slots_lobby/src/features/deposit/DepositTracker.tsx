import { overlayContainer } from '../../app/designViewport';
import { t } from '../../i18n';
import { useEffect } from 'react';
import { message } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../../stores/session';
import { clearIntent,readIntent,useDepositIntent } from './intent';
import { useDepositOrder } from './useDepositOrder';
export function DepositTracker({onSuccess}:{onSuccess?:()=>void}){
 const uid=useSessionStore(state=>state.session?.uid)??0;
 const intent=useDepositIntent(uid);const order=useDepositOrder(uid,intent);const client=useQueryClient();
 const [toast,holder]=message.useMessage({getContainer:overlayContainer,top:'calc(var(--lobby-safe-top, 0px) + 12px)',maxCount:1,classNames:{list:'lobby-toast-list'}});
 useEffect(()=>{
  const data=order.data;
  if(!intent||!data||data.status==='pending'||useSessionStore.getState().session?.uid!==uid||readIntent(uid)?.requestId!==intent.requestId)return;
  clearIntent(uid);
  if(data.status==='success'){
   void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});
   void client.invalidateQueries({queryKey:['cash-records']});
   void client.invalidateQueries({queryKey:['wallet-ledger']});
   void client.invalidateQueries({queryKey:['recharge-order',uid,data.orderId]});
   void toast.success({key:'deposit-success',content:t('copy.depositSuccessful'),duration:2});onSuccess?.();
  }else void toast.error({key:'deposit-failed',content:t('copy.theDepositOrderFailedPleaseCreateA')});
 },[order.data,intent,uid,client,toast,onSuccess]);
 return holder;
}
