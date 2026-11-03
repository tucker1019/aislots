import {ensureSession,request} from './account';
import {isRecord} from '../features/account/types';
import {t} from '../i18n';
export interface InviteRules {version:string;durationDays:number;minDepositCount:number;minDepositAmount:number;minBetAmount:number;rewardAmount:number;displayRows:number}
export interface InviteInfo {inviteUrl:string;supportUrl:string;rules:InviteRules;invitedCount:number;qualifiedCount:number;pendingAmount:number;claimedAmount:number}
function amount(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(t('invite.invalidData'));return value;}
function safeUrl(value:unknown):string{if(typeof value!=='string')throw new Error(t('invite.invalidData'));const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error(t('invite.invalidData'));return url.href;}
export function parseInviteInfo(data:unknown):InviteInfo{
 if(!isRecord(data)||!isRecord(data.rules)||typeof data.rules.version!=='string')throw new Error(t('invite.invalidData'));
 const rule=data.rules;const rules={version:String(rule.version),durationDays:amount(rule.durationDays),minDepositCount:amount(rule.minDepositCount),minDepositAmount:amount(rule.minDepositAmount),minBetAmount:amount(rule.minBetAmount),rewardAmount:amount(rule.rewardAmount),displayRows:amount(rule.displayRows)};
 if(rules.durationDays<1||rules.minDepositCount<1||rules.minDepositAmount<1||rules.minBetAmount<1||rules.rewardAmount<1||rules.displayRows<1||rules.displayRows>50||rules.rewardAmount*rules.displayRows>Number.MAX_SAFE_INTEGER)throw new Error(t('invite.invalidData'));
 return {inviteUrl:safeUrl(data.inviteUrl),supportUrl:safeUrl(data.supportUrl),rules,invitedCount:amount(data.invitedCount),qualifiedCount:amount(data.qualifiedCount),pendingAmount:amount(data.pendingAmount),claimedAmount:amount(data.claimedAmount)};
}
export async function callInvite(path:string,fields:Record<string,string|number>,signal?:AbortSignal){const identity=await ensureSession();return request('/api/activity/invite/'+path,{method:'POST',signal,body:JSON.stringify({uid:identity.uid,sid:identity.sid,...fields})},t('invite.requestFailed'));}
export async function fetchInviteInfo(signal?:AbortSignal){return parseInviteInfo(await callInvite('info',{},signal));}
export async function claimInvite(requestId:string){const data=await callInvite('claim',{requestId});if(!isRecord(data)||typeof data.claimId!=='string'||!data.claimId)throw new Error(t('invite.requestFailed'));return amount(data.totalReward);}
