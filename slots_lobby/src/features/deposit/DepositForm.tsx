import { t, getLocale } from '../../i18n';
import { Icon } from '../../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { useDepositOrder } from './useDepositOrder';
import type { RechargeTier } from '../../services/recharge';
import { coinsLabel } from '../account/formatCoins';
import { useDepositIntent, readIntent, saveIntent } from './intent';
import { OrderPanel } from './OrderPanel';
export function DepositForm({uid,tiers}:{uid:number;tiers:RechargeTier[]}) {
 const intent=useDepositIntent(uid);
 const [selected,setSelected]=useState(()=>readIntent(uid)?.tierId||tiers[0]?.id||'');
 const [localError,setLocalError]=useState('');
 const lock=useRef(false);
 const order=useDepositOrder(uid,intent);
 const previous=useRef(intent);
 useEffect(()=>{if(previous.current&&!intent){setSelected(tiers[0]?.id??'');setLocalError('');}previous.current=intent;},[intent,tiers]);
 const terminal=order.data?.status==='success'||order.data?.status==='failed';
 const locked=!!intent&&!terminal;
 const tier=tiers.find(item=>item.id===selected);
 const detail=locked&&order.data?order.data:tier;
 async function submit() {
  if(lock.current||(!tier&&!intent))return;
  lock.current=true;setLocalError('');
  try {if(intent)await order.refetch();else saveIntent(uid,{tierId:selected,requestId:crypto.randomUUID()});}
  catch(error){setLocalError(error instanceof Error?error.message:t('copy.orderSubmissionFailedPleaseRetry'));}
  finally{lock.current=false;}
 }

 return <>
  <section className="deposit-card" aria-labelledby="deposit-amount-title"><h2 id="deposit-amount-title">{t('copy.selectDepositAmount')}</h2><div className="deposit-tiers">{tiers.map(item=><button type="button" key={item.id} aria-pressed={selected===item.id} disabled={locked||order.isFetching} onClick={()=>{setSelected(item.id);setLocalError('');}}><span className="deposit-tier-symbol" aria-hidden="true"><Icon name="coin" size={25} /></span><strong>{coinsLabel(item.amount)}</strong>{(item.bonus>0||item.fee>0)&&<span className={`deposit-tier-badge ${item.bonus>0?'tier-bonus':'tier-fee'}`}>{item.bonus>0?t('copy.bonus'):t('copy.fee')}{((item.bonus||item.fee)/item.amount*100).toLocaleString(getLocale(),{maximumFractionDigits:4})}%</span>}</button>)}</div></section>
  {detail&&<section className="deposit-card deposit-summary" aria-label={t('copy.depositBreakdown')}><dl>{[[t('copy.depositPrincipal'),detail.amount],[t('copy.bonusAmount'),detail.bonus],[t('copy.fee'),detail.fee],[t('copy.amountCredited'),detail.creditAmount]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{coinsLabel(Number(amount))}</dd></div>)}</dl></section>}
  {(localError||order.isError)&&<p className="deposit-error" role="alert">{localError||order.error?.message}</p>}
  {!intent?.orderId&&<button type="button" className="deposit-submit" disabled={order.isFetching||(!tier&&!locked)} onClick={()=>void submit()}>{order.isFetching?t('copy.creatingOrder'):locked?t('copy.retryThisOrder'):t('copy.createOrder')}</button>}
  {intent?.orderId&&order.data?.status!=='success'&&<OrderPanel order={order.data} loading={order.isFetching} error={order.isError} onRefresh={()=>void order.refetch()} />}
 </>;
}
