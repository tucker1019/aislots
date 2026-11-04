import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
import { t } from '../i18n';
export interface WithdrawalTier { id:string;amount:number;fee:number;bonus:number;payoutAmount:number }
export interface WithdrawalOrder {orderId:string;kind:'withdrawal';amount:number;fee:number;bonus:number;creditAmount:number;status:'pending'|'success'|'failed';channel:string;account:string;name:string;createdAt:string;settledAt:string;testMode:boolean;paymentUrl:string}
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export function parseWithdrawal(value:unknown):WithdrawalOrder{
 if(!isRecord(value)||typeof value.orderId!=='string'||!value.orderId.startsWith('wdr_')||value.kind!=='withdrawal'||!money(value.amount)||!money(value.fee)||!money(value.bonus)||!money(value.creditAmount)||value.amount<=0||value.fee>=value.amount||value.creditAmount!==value.amount-value.fee||(value.fee>0&&value.bonus>0)||!['pending','success','failed'].includes(String(value.status))||!['channel','account','name','createdAt','settledAt'].every(k=>typeof value[k]==='string')||!Number.isFinite(Date.parse(String(value.createdAt)))||typeof value.testMode!=='boolean')throw new Error(t('withdrawal.invalid'));
 return {orderId:value.orderId,kind:'withdrawal',amount:value.amount,fee:value.fee,bonus:value.bonus,creditAmount:value.creditAmount,status:value.status as WithdrawalOrder['status'],channel:String(value.channel),account:String(value.account),name:String(value.name),createdAt:String(value.createdAt),settledAt:String(value.settledAt),testMode:value.testMode,paymentUrl:''};
}
async function call(path:string,fields:Record<string,string>={},signal?:AbortSignal,expectedUid?:number){const s=await ensureSession();if(expectedUid!==undefined&&s.uid!==expectedUid)throw new Error(t('copy.accountChangedPleaseTryAgain'));return request('/api/user/'+path,{method:'POST',signal,body:JSON.stringify({uid:s.uid,sid:s.sid,...fields})},t('withdrawal.requestFailed'));}
export async function loadWithdrawalTiers(signal?:AbortSignal){const data=await call('withdrawal/tiers',{},signal);if(!isRecord(data)||!Array.isArray(data.items)||typeof data.testMode!=='boolean')throw new Error(t('withdrawal.invalid'));const items=data.items.map((v:unknown):WithdrawalTier=>{if(!isRecord(v)||typeof v.id!=='string'||!money(v.amount)||!money(v.fee)||!money(v.bonus)||!money(v.payoutAmount)||v.amount<=0||v.fee>=v.amount||v.payoutAmount!==v.amount-v.fee||(v.bonus>0&&v.fee>0))throw new Error(t('withdrawal.invalid'));return {id:v.id,amount:v.amount,fee:v.fee,bonus:v.bonus,payoutAmount:v.payoutAmount};});if(new Set(items.map(v=>v.id)).size!==items.length)throw new Error(t('withdrawal.invalid'));return {items,testMode:data.testMode};}
export async function createWithdrawal(tierId:string,channel:string,requestId:string,expectedUid?:number){return parseWithdrawal(await call('withdrawal/create',{tierId,channel,requestId},undefined,expectedUid));}
export async function fetchWithdrawal(orderId:string,signal?:AbortSignal){const result=parseWithdrawal(await call('withdrawal/info',{orderId},signal));if(result.orderId!==orderId)throw new Error(t('withdrawal.invalid'));return result;}
export async function reviewWithdrawal(orderId:string,decision:'approve'|'return'){return parseWithdrawal(await call('withdrawal/test-review',{orderId,decision}));}

export interface WithdrawalTurnover {remaining:number;canWithdraw:boolean}
export function parseWithdrawalTurnover(value:unknown):WithdrawalTurnover{
 if(!isRecord(value)||!money(value.remaining)||typeof value.canWithdraw!=='boolean'||value.canWithdraw!==(value.remaining===0))throw new Error(t('withdrawal.invalid'));
 return {remaining:value.remaining,canWithdraw:value.canWithdraw};
}
export async function loadWithdrawalTurnover(signal?:AbortSignal){return parseWithdrawalTurnover(await call('withdrawal/turnover',{},signal));}
