import {isRecord} from '../features/account/types';
import {t} from '../i18n';
import {callInvite,parseInviteInfo,type InviteInfo} from './invite';
export interface InviteChest {slot:number;rewardId:string;amount:number;status:'locked'|'claimable'|'claimed'}
export interface InviteChests {info:InviteInfo;items:InviteChest[];page:number;hasMore:boolean}
export type InviteReason='deposit_count'|'deposit_amount'|'bet_amount';
export interface InviteFriend {uid:string;account:string;registeredAt:string;depositCount:number;depositAmount:number;betAmount:number;qualified:boolean;reasons:InviteReason[];requiredDepositCount:number;requiredDepositAmount:number;requiredBetAmount:number;durationDays:number}
function invalid():never{throw new Error(t('invite.invalidData'));}
function integer(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:invalid();}
function list(value:unknown):unknown[]{return Array.isArray(value)?value:invalid();}
function boolean(value:unknown){return typeof value==='boolean'?value:invalid();}
export function parseChests(data:unknown):InviteChests{
 if(!isRecord(data))return invalid();const page=integer(data.page);if(page<1)return invalid();
 const items=list(data.items).map((item,index):InviteChest=>{if(!isRecord(item)||!['locked','claimable','claimed'].includes(String(item.status)))return invalid();const slot=integer(item.slot);const status=item.status as InviteChest['status'];const rewardId=typeof item.rewardId==='string'?item.rewardId:'';if(slot!==(page-1)*100+index+1||(status!=='locked'&&!/^[1-9]\d*$/.test(rewardId)))return invalid();return {slot,rewardId,amount:integer(item.amount),status};});
 if(items.length!==100)return invalid();return {info:parseInviteInfo(data.info),items,page,hasMore:boolean(data.hasMore)};
}
export async function fetchInviteChests(page:number,signal?:AbortSignal){return parseChests(await callInvite('chests',{page},signal));}
export async function claimInviteChest(rewardId:string,requestId:string){const data=await callInvite('chest/claim',{rewardId,requestId});if(!isRecord(data)||typeof data.claimId!=='string'||!data.claimId)return invalid();return integer(data.totalReward);}
export function parseFriends(data:unknown){
 if(!isRecord(data))return invalid();const page=integer(data.page);if(page<1)return invalid();const items=list(data.items).map((item):InviteFriend=>{
 if(!isRecord(item)||typeof item.uid!=='string'||typeof item.account!=='string'||typeof item.registeredAt!=='string'||!Number.isFinite(Date.parse(item.registeredAt)))return invalid();
 const reasons=list(item.reasons).map((r):InviteReason=>r==='deposit_count'||r==='deposit_amount'||r==='bet_amount'?r:invalid());
 return {uid:item.uid,account:item.account,registeredAt:item.registeredAt,depositCount:integer(item.depositCount),depositAmount:integer(item.depositAmount),betAmount:integer(item.betAmount),qualified:boolean(item.qualified),reasons,requiredDepositCount:integer(item.requiredDepositCount),requiredDepositAmount:integer(item.requiredDepositAmount),requiredBetAmount:integer(item.requiredBetAmount),durationDays:integer(item.durationDays)};
 });return {items,page,hasMore:boolean(data.hasMore)};
}
export async function fetchInviteFriends(page:number,signal?:AbortSignal){return parseFriends(await callInvite('friends',{page},signal));}
