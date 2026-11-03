import { t, getLocale } from '../i18n';
import {ensureSession,request} from './account';
import {isRecord} from '../features/account/types';
export interface RebatePreview {reward:number;availableAt:string}
export interface RebatePlatform {name:string;dailyRateBps:number;weeklyRateBps:number;monthlyRateBps:number}
export interface RebateInfo {activityDate:string;timezone:string;claimableTotal:number;daily:RebatePreview;weekly:RebatePreview;monthly:RebatePreview;platforms:RebatePlatform[]}
function amount(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error(t('copy.invalidRebateData'));return Number(value);}
function preview(value:unknown):RebatePreview{if(!isRecord(value)||!isRecord(value.preview)||typeof value.preview.availableAt!=='string'||!Number.isFinite(Date.parse(value.preview.availableAt)))throw new Error(t('copy.invalidRebatePeriod'));return {reward:amount(value.preview.reward),availableAt:value.preview.availableAt};}
export function parseRebate(data:unknown):RebateInfo{
 if(!isRecord(data)||typeof data.activityDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.activityDate)||typeof data.timezone!=='string'||!Array.isArray(data.platforms))throw new Error(t('copy.invalidRebateData'));
 try{new Intl.DateTimeFormat(getLocale(),{timeZone:data.timezone});}catch{throw new Error(t('copy.invalidRebateTimezone'));}
 const platforms=data.platforms.map((row:unknown)=>{if(!isRecord(row)||typeof row.name!=='string')throw new Error(t('copy.invalidProviderData'));const dailyRateBps=amount(row.dailyRateBps),weeklyRateBps=amount(row.weeklyRateBps),monthlyRateBps=amount(row.monthlyRateBps);if(Math.max(dailyRateBps,weeklyRateBps,monthlyRateBps)>10000)throw new Error(t('copy.invalidRebateRate'));return {name:row.name,dailyRateBps,weeklyRateBps,monthlyRateBps};});
 return {activityDate:data.activityDate,timezone:data.timezone,claimableTotal:amount(data.claimableTotal),daily:preview(data.daily),weekly:preview(data.weekly),monthly:preview(data.monthly),platforms};
}
export async function fetchRebate(signal?:AbortSignal){const identity=await ensureSession();return parseRebate(await request('/api/activity/rebate/info?'+new URLSearchParams({uid:String(identity.uid),sid:identity.sid}),{signal},t('copy.rebateInformationFailedToLoadPleaseRetry')));}
export async function claimRebate(activityDate:string){const identity=await ensureSession();const data=await request('/api/activity/rebate/claim',{method:'POST',body:JSON.stringify({uid:identity.uid,sid:identity.sid,activityDate})},t('copy.claimIncompletePleaseRetryIfTheDay'));if(!isRecord(data)||data.activityDate!==activityDate||typeof data.claimId!=='string')throw new Error(t('copy.invalidClaimResultPleaseRetryToConfirm'));return amount(data.totalReward);}
