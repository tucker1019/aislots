import { t, getLocale } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export interface LossReturnInfo {activityDate:string;timezone:string;claimable:number;loss:number;reward:number;rateBps:number}
export function parseLossReturn(data:unknown):LossReturnInfo {
 const invalid=()=>new Error(t('copy.invalidRebateData'));
 const amount=(value:unknown):number=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw invalid();return value;};
 if(!isRecord(data)||typeof data.activityDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.activityDate)||typeof data.timezone!=='string'||!isRecord(data.daily)||!isRecord(data.daily.preview))throw invalid();
 new Intl.DateTimeFormat(getLocale(),{timeZone:data.timezone});
 const preview=data.daily.preview,rateBps=amount(preview.rateBps);
 if(rateBps>10000)throw invalid();
 return {activityDate:data.activityDate,timezone:data.timezone,claimable:amount(data.claimableTotal),loss:amount(preview.lossAmount),reward:amount(preview.reward),rateBps};
}
export async function fetchLossReturn(signal?:AbortSignal){const identity=await ensureSession();return parseLossReturn(await request('/api/activity/loserreturn/info?'+new URLSearchParams({uid:String(identity.uid),sid:identity.sid}),{signal},t('copy.rebateInformationFailedToLoadPleaseRetry')));}
export async function claimLossReturn(activityDate:string){const identity=await ensureSession();const data=await request('/api/activity/loserreturn/claim',{method:'POST',body:JSON.stringify({uid:identity.uid,sid:identity.sid,activityDate})},t('copy.claimIncompletePleaseRetryIfTheDay'));if(!isRecord(data)||data.activityDate!==activityDate||typeof data.claimId!=='string'||typeof data.totalReward!=='number'||!Number.isSafeInteger(data.totalReward)||data.totalReward<0)throw new Error(t('copy.invalidClaimResultPleaseRetryToConfirm'));return data.totalReward;}
