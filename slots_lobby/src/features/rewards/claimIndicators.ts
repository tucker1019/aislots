import type {QueryClient} from '@tanstack/react-query';
import {loadCheckinOverview} from '../../services/benefits';
import {loadVipDetails} from '../../services/vip-details';
import {fetchRebate} from '../../services/rebate';
import {fetchLossReturn} from '../../services/loss-return';
import {fetchInviteInfo} from '../../services/invite';
import {fetchAgent,agentDefaults} from '../../services/agent';
import {isRecord} from '../account/types';
export type RewardGroup='checkin'|'vip'|'rebate'|'loss'|'invite'|'agent';
export type RewardKey='checkin'|'weekly'|'monthly'|'upgrade'|'rebate'|'loss'|'invite'|'agent';
export type RewardCounts=Partial<Record<RewardKey,number>>;
export const groups:RewardGroup[]=['checkin','vip','rebate','loss','invite','agent'];
export const indicatorKey=(uid:number,group:RewardGroup)=>['claim-indicators',uid,group] as const;
export async function loadIndicator(group:RewardGroup,signal:AbortSignal):Promise<RewardCounts>{
 switch(group){
 case 'checkin':{const v=await loadCheckinOverview(signal);return {checkin:!v.claimed&&v.canClaim&&v.reward>0?1:0};}
 case 'vip':{const v=await loadVipDetails(signal);return {weekly:v.weekly.status==='claimable'&&v.weekly.amount>0?1:0,monthly:v.monthly.status==='claimable'&&v.monthly.amount>0?1:0,upgrade:v.upgradeRewards.filter(r=>r.status==='claimable'&&r.amount>0).length};}
 case 'rebate':return {rebate:(await fetchRebate(signal)).claimableTotal};
 case 'loss':return {loss:(await fetchLossReturn(signal)).claimable};
 case 'invite':return {invite:(await fetchInviteInfo(signal)).pendingAmount};
 case 'agent':return {agent:(await fetchAgent('center',agentDefaults,signal)).summary.claimable};
 }
}
export function aggregateIndicators(values:RewardCounts[]){
 const counts=Object.assign({},...values) as RewardCounts;
 const active=(key:RewardKey)=>(counts[key]??0)>0;
 return {active,earn:['rebate','loss','invite','agent'].some(key=>active(key as RewardKey)),my:['checkin','weekly','monthly','upgrade','agent'].some(key=>active(key as RewardKey)),vip:['weekly','monthly','upgrade'].some(key=>active(key as RewardKey))};
}
/** Optimistic removal is applied only after a successful credit response. */
export async function rewardClaimed(client:QueryClient,uid:number,group:RewardGroup,data:unknown,variables:unknown,kind?:unknown){
 const key=indicatorKey(uid,group);
 client.setQueryData<RewardCounts>(key,old=>{
  const next={...old};
  if(group==='vip'){
   const rewardKind=typeof kind==='string'?kind:isRecord(variables)?variables.kind:undefined;
   if(rewardKind==='upgrade')next.upgrade=isRecord(variables)&&typeof variables.rewardId==='string'?Math.max(0,(next.upgrade??0)-1):0;
   else if(rewardKind==='weekly'||rewardKind==='monthly')next[rewardKind]=0;
  }else if(group==='invite')next.invite=typeof data==='number'?Math.max(0,(next.invite??0)-data):next.invite;
  else next[group]=0;
  return next;
 });
 await client.invalidateQueries({queryKey:key});
}
