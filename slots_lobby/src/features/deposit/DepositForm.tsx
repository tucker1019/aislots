import {AsyncButton} from '../../components/buttons/AsyncButton';
import { t, getLocale } from '../../i18n';
import { Icon } from '../../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { depositOrderQuery } from './useDepositOrder';
import {useQueryClient} from '@tanstack/react-query';
import type { RechargeTier } from '../../services/recharge';
import { coinsLabel } from '../account/formatCoins';
import { useDepositIntent, readIntent, saveIntent } from './intent';
import {paymentLink} from '../../services/recharge';
export function DepositForm({uid,tiers}:{uid:number;tiers:RechargeTier[]}) {
 const intent=useDepositIntent(uid);
 const [selected,setSelected]=useState(()=>readIntent(uid)?.tierId||tiers[0]?.id||'');
 const [localError,setLocalError]=useState('');
 const lock=useRef(false);
 const client=useQueryClient();
 const [submitting,setSubmitting]=useState(false);
 const previous=useRef(intent);
 useEffect(()=>{if(previous.current&&!intent){setSelected(tiers[0]?.id??'');setLocalError('');}previous.current=intent;},[intent,tiers]);
 const locked=!!intent;
 const tier=tiers.find(item=>item.id===selected);
 const detail=tier;
 async function submit() {
  if(lock.current||(!tier&&!intent))return;
  const popup=window.open('about:blank','_blank');
  if(!popup){setLocalError(t('deposit.allowPaymentWindow'));return;}
  popup.opener=null;
  lock.current=true;setSubmitting(true);setLocalError('');
  try {
   const current=readIntent(uid)??{tierId:selected,requestId:crypto.randomUUID()};
   if(!readIntent(uid))saveIntent(uid,current);
   const result=await client.fetchQuery({...depositOrderQuery(uid,current),staleTime:0,retry:false});
   const url=paymentLink(result.paymentUrl);
   if(result.status==='pending'&&url)popup.location.replace(url);
   else {popup.close();if(result.status==='pending')setLocalError(t('copy.invalidOrderResponsePleaseRetry'));}
  }catch(error){popup.close();setLocalError(error instanceof Error?error.message:t('copy.orderSubmissionFailedPleaseRetry'));}
  finally{lock.current=false;setSubmitting(false);}
 }

 return <>
  <section className="deposit-card" aria-labelledby="deposit-amount-title"><h2 id="deposit-amount-title">{t('copy.selectDepositAmount')}</h2><div className="deposit-tiers">{tiers.map(item=><button type="button" key={item.id} aria-pressed={selected===item.id} disabled={locked||submitting} onClick={()=>{setSelected(item.id);setLocalError('');}}><span className="deposit-tier-symbol" aria-hidden="true"><Icon name="coin" size={25} /></span><strong>{coinsLabel(item.amount)}</strong>{(item.bonus>0||item.fee>0)&&<span className={`deposit-tier-badge ${item.bonus>0?'tier-bonus':'tier-fee'}`}>{item.bonus>0?t('copy.bonus'):t('copy.fee')}{((item.bonus||item.fee)/item.amount*100).toLocaleString(getLocale(),{maximumFractionDigits:4})}%</span>}</button>)}</div></section>
  {detail&&<section className="deposit-card deposit-summary" aria-label={t('copy.depositBreakdown')}><dl>{[[t('copy.depositPrincipal'),detail.amount],[t('copy.bonusAmount'),detail.bonus],[t('copy.fee'),detail.fee],[t('copy.amountCredited'),detail.creditAmount]].map(([label,amount])=><div key={label}><dt>{label}</dt><dd>{coinsLabel(Number(amount))}</dd></div>)}</dl></section>}
  {localError&&<p className="deposit-error" role="alert">{localError}</p>}
  <AsyncButton loading={submitting} type="button" className="deposit-submit" disabled={submitting||(!tier&&!locked)} onClick={()=>void submit()}>{t('copy.createOrder')}</AsyncButton>
 </>;
}
