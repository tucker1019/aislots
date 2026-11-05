import { overlayContainer } from '../../app/designViewport';
import { t, getLocale } from '../../i18n';
import { useRef,useState } from 'react';
import { Modal,Progress } from 'antd';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import type { VipOverview } from '../../services/benefits';
import { claimVipReward } from '../../services/vip-details';
import { BenefitCard } from './BenefitCard';
import { betMoney } from '../bet-records/money';
import { useClaimToast } from '../rewards/useClaimToast';
export function SalaryBenefit({kind,info}:{kind:'weekly'|'monthly';info:VipOverview}){
 const [open,setOpen]=useState(false);const [claimed,setClaimed]=useState<string|null>(null);const intent=useRef<{date:string;id:string}|null>(null);const lock=useRef(false);const client=useQueryClient();const {notify,holder}=useClaimToast();
 const current=info[kind];const preview=kind==='weekly'?info.weeklyPreview:info.monthlyPreview;
 const locallyClaimed=claimed!==null&&claimed===info.activityDate;
 const isClaimed=current?.status==='claimed'||locallyClaimed;
 const claimable=current?.status==='claimable'&&!isClaimed;
 const period=current&&['claimable','claimed'].includes(current.status)?current:preview;
 const name=kind==='weekly'?t('copy.weeklyGift'):t('copy.monthlyGift');const cycle=kind==='weekly'?t('copy.thisWeek'):t('copy.thisMonth');
 const claim=useMutation({mutationFn:({date,id}:{date:string;id:string})=>claimVipReward(kind,date,id),retry:false,onSuccess:()=>{setClaimed(intent.current?.date??null);intent.current=null;notify();void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});void client.invalidateQueries({queryKey:['lobby','benefits','vip']});void client.invalidateQueries({queryKey:['lobby','vip-details']});void client.invalidateQueries({queryKey:['wallet-ledger']});}});
 async function receive(){if(lock.current||(!claimable&&!intent.current)||!info.activityDate)return;lock.current=true;intent.current??={date:info.activityDate,id:crypto.randomUUID()};try{await claim.mutateAsync(intent.current);}catch{/* Inline error retains the same claim intent. */}finally{lock.current=false;}}
 const time=(value:string)=>{if(!value||!Number.isFinite(Date.parse(value)))return '—';try{return new Date(value).toLocaleString(getLocale(),{timeZone:info.timezone||'UTC',hour12:false});}catch{return '—';}};
 return <>{holder}<BenefitCard title={name} icon={kind==='weekly'?'gift':'calendar'} tone={kind==='weekly'?'blue':'rose'} value={betMoney(current&&['claimable','claimed'].includes(current.status)?current.amount:kind==='weekly'?info.weeklyReward:info.monthlyReward)} description={kind==='weekly'?t('copy.meetTheWeeklyRequirementsToClaimYour'):t('copy.meetTheMonthlyRequirementsToClaimYour')} action={claim.isPending?t('copy.claiming'):isClaimed?t('copy.claimed076'):claimable?t('copy.claim'):t('copy.claimProgress')} disabled={claim.isPending||isClaimed} onAction={()=>{if(claimable)void receive();else setOpen(true);}}/>
 {claim.isError&&<p role="alert" className="vip-salary-error">{claim.error.message}<button type="button" disabled={claim.isPending} onClick={()=>void receive()}>{t('copy.retryClaim')}</button></p>}
 {open&&<Modal getContainer={overlayContainer} open centered footer={null} closable={false} title={null} width={400} onCancel={()=>setOpen(false)} className="vip-upgrade-modal"><section className="vip-upgrade-panel" aria-label={t('copy.valueRequirements', {p0: name})}><h2>{name}{t('copy.claimRequirements')}</h2><div className="vip-upgrade-body">
 {period?<>{([{label:t('copy.valueDeposits', {p0: current===period?t('copy.settlementPeriod'):cycle}),actual:period.actualRecharge,required:period.requiredRecharge},{label:t('copy.valueTurnover', {p0: current===period?t('copy.settlementPeriod'):cycle}),actual:period.actualBet,required:period.requiredBet}]).map(row=><div className="vip-upgrade-progress" key={row.label}><div><span>{row.label}</span><span><b>{betMoney(row.actual)}</b> / {betMoney(row.required)}</span></div><Progress percent={row.required?Math.min(100,row.actual/row.required*100):100} showInfo={false} size="small" aria-label={row.label}/></div>)}<p className="vip-upgrade-notice">{t('copy.claimWindow')}{time(period.availableAt)}{period.expiresAt&&t('copy.toValue', {p0: time(period.expiresAt)})}<br/>{info.timezone&&t('copy.activityTimezoneValue', {p0: info.timezone})}<br/>{period.amount===0?t('copy.noGiftIsAvailableAtThisLevel'):current===period?t('copy.requirementsAndProgressForTheSettledPeriod'):t('copy.thisPeriodSEstimateCanOnlyBe')}</p></>:<p className="vip-upgrade-notice">{t('copy.claimRequirementsAreUnavailablePleaseRefreshLater')}</p>}
 <button type="button" className="vip-upgrade-home" onClick={()=>setOpen(false)}>{t('copy.gotIt')}</button></div></section></Modal>}
 </>;
}
