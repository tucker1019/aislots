import { t } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export const reportPeriods = () => ({today:t('copy.today'),yesterday:t('copy.yesterday'),this_week:t('copy.thisWeek363'),last_week:t('copy.lastWeek')} as const);
export type ReportPeriod = keyof ReturnType<typeof reportPeriods>;
export interface ReportMetric { key:string;label:string;amount:number;supported:boolean }
export interface PersonalReport { items:ReportMetric[];from:string;to:string;timezone:string;currency:string }
export function parsePersonalReport(data:unknown):PersonalReport {
 if (!isRecord(data)||!Array.isArray(data.items)||!data.items.length||typeof data.from!=='string'||typeof data.to!=='string'||!Number.isFinite(Date.parse(data.from))||!Number.isFinite(Date.parse(data.to))||Date.parse(data.to)<=Date.parse(data.from)||typeof data.timezone!=='string'||typeof data.currency!=='string') throw new Error(t('copy.invalidReportData'));
 const seen=new Set<string>();
 const items=data.items.map((item:unknown):ReportMetric=>{
  if(!isRecord(item)||typeof item.key!=='string'||!item.key||seen.has(item.key)||typeof item.label!=='string'||!item.label||typeof item.supported!=='boolean'||typeof item.amount!=='number'||!Number.isSafeInteger(item.amount)||(!['gameProfit','netProfit'].includes(item.key)&&item.amount<0))throw new Error(t('copy.invalidReportData'));
  seen.add(item.key);return {key:item.key,label:item.label,amount:item.amount,supported:item.supported};
 });
 if(!seen.has('netProfit'))throw new Error(t('copy.reportSummaryIsMissing'));
 return {items,from:data.from,to:data.to,timezone:data.timezone,currency:data.currency};
}
export async function fetchPersonalReport(period:ReportPeriod,signal?:AbortSignal):Promise<PersonalReport>{
 const identity=await ensureSession();
 return parsePersonalReport(await request('/api/user/report',{method:'POST',signal,body:JSON.stringify({uid:identity.uid,sid:identity.sid,period})},t('copy.personalReportFailedToLoadPleaseRetry')));
}
