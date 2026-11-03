import {ensureSession,request} from './account';
import {isRecord} from '../features/account/types';
import {t} from '../i18n';
export type AgentView = 'center'|'team'|'performance'|'performance-details'|'report'|'report-details'|'rates'|'records'|'rules';
export type AgentPeriod = 'today'|'yesterday'|'this_week'|'last_week'|'this_month'|'last_month';
export interface AgentParams {period:AgentPeriod;provider:string;scope:string;search:string;targetUid:number;page:number;kind:string}
export const agentDefaults:AgentParams={period:'today',provider:'',scope:'all',search:'',targetUid:0,page:1,kind:'team'};
export const agentPeriods:AgentPeriod[]=['today','yesterday','this_week','last_week','this_month','last_month'];
export interface AgentRow {uid:number;account:string;registeredAt:string;depth:number;children:number;provider:string;validBet:number;teamBet:number;commission:number;profit:number;amount:number;paymentType:string;claimId:string;createdAt:string;threshold:number;perTenThousand:number}
export const agentSummaryKeys=['teamCount','directCount','otherCount','newCount','directNew','otherNew','validBet','commission','directCommission','otherCommission','claimable','betCount','bettorCount','profit','firstDepositCount','firstDepositAmount','depositCount','depositAmount','withdrawalCount','withdrawalAmount'] as const;
export type AgentSummary=Record<typeof agentSummaryKeys[number],number>;
export interface AgentData {summary:AgentSummary;items:AgentRow[];hasMore:boolean;from:string;to:string;timezone:string;status:string;updatedAt:string;providers:string[];inviteUrl:string;account:string}
const rowNumbers=['uid','depth','children','validBet','teamBet','commission','profit','amount','threshold','perTenThousand'] as const;
const rowStrings=['account','registeredAt','provider','paymentType','claimId','createdAt'] as const;
export function parseAgent(data:unknown):AgentData{
 const invalid=()=>new Error(t('agent.invalid'));
 if(!isRecord(data)||!isRecord(data.summary)||!agentSummaryKeys.every(k=>Number.isSafeInteger(data.summary && isRecord(data.summary)?data.summary[k]:undefined))||!Array.isArray(data.items)||typeof data.hasMore!=='boolean'||!Array.isArray(data.providers)||!data.providers.every(p=>typeof p==='string')||!['from','to','timezone','status','updatedAt','inviteUrl','account'].every(k=>typeof data[k]==='string'))throw invalid();
 const items=data.items.map((r:unknown)=>{if(!isRecord(r)||!rowNumbers.every(k=>Number.isSafeInteger(r[k]))||!rowStrings.every(k=>typeof r[k]==='string'))throw invalid();return r as unknown as AgentRow;});
 return {...data,items} as unknown as AgentData;
}
const paths:Record<Exclude<AgentView,'rules'>,string>={center:'info',team:'team',performance:'performance','performance-details':'performance/details',report:'report','report-details':'report/details',rates:'rates',records:'records'};
export async function fetchAgent(view:Exclude<AgentView,'rules'>,params:AgentParams,signal?:AbortSignal):Promise<AgentData>{
 const identity=await ensureSession();return parseAgent(await request('/api/agent/'+paths[view],{method:'POST',signal,body:JSON.stringify({...identity,...params})},t('agent.loadFailed')));
}
export async function claimAgent(requestId:string):Promise<{claimId:string;amount:number;coins:number}>{
 const identity=await ensureSession();const data=await request('/api/agent/claim',{method:'POST',body:JSON.stringify({...identity,requestId})},t('agent.claimFailed'));
 if(!isRecord(data)||typeof data.claimId!=='string'||!Number.isSafeInteger(data.amount)||!Number.isSafeInteger(data.coins))throw new Error(t('agent.invalid'));
 return data as unknown as {claimId:string;amount:number;coins:number};
}
