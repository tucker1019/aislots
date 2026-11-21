import {request} from './account';
import {isRecord} from '../features/account/types';
import {isGameId} from '../app/games';
import {useSessionStore} from '../stores/session';
import {t} from '../i18n';

export interface RecentWin {
 id:string; betId:string; betAmount:string; avatarId:number; gameId:string; gameName:string; gameNameEn:string; cover:string;
 nickname:string; winAmount:string; multiplier:string; occurredAt:string; isSelf:boolean; uid:string; anonymous:boolean;
}
export interface RecentWins {items:RecentWin[];updatedAt:string}
const instant=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
function validCover(value:unknown):value is string {
 if(typeof value!=='string')return false;
 if(value.startsWith('/assets/'))return !/[\\%?#\r\n]/.test(value)&&new URL(value,'https://local.example').pathname===value;
 try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{return false;}
}
export function parseRecentWins(data:unknown):RecentWins {
 if(!isRecord(data)||!Array.isArray(data.items)||data.items.length>50||!instant(data.updatedAt))throw new Error(t('statistics.invalid'));
 const ids=new Set<string>();
 const items=data.items.map((row:unknown):RecentWin=>{
  if(!isRecord(row)||typeof row.id!=='string'||! /^[1-9]\d*$/.test(row.id)||ids.has(row.id)||
   typeof row.gameId!=='string'||!isGameId(row.gameId)||typeof row.gameName!=='string'||typeof row.gameNameEn!=='string'||!validCover(row.cover)||
   typeof row.betId!=='string'||!row.betId||typeof row.betAmount!=='string'||! /^\d+$/.test(row.betAmount)||!Number.isInteger(row.avatarId)||Number(row.avatarId)<1||Number(row.avatarId)>15||
   typeof row.nickname!=='string'||typeof row.uid!=='string'||typeof row.anonymous!=='boolean'||typeof row.winAmount!=='string'||! /^\d+$/.test(row.winAmount)||typeof row.multiplier!=='string'||! /^\d+(\.\d+)?$/.test(row.multiplier)||
   !instant(row.occurredAt)||typeof row.isSelf!=='boolean')throw new Error(t('statistics.invalid'));
  ids.add(row.id);
  return {id:row.id,betId:row.betId,betAmount:row.betAmount,avatarId:Number(row.avatarId),gameId:row.gameId,gameName:row.gameName,gameNameEn:row.gameNameEn,cover:row.cover,nickname:row.nickname,winAmount:row.winAmount,multiplier:row.multiplier,occurredAt:row.occurredAt,isSelf:row.isSelf,uid:row.uid,anonymous:row.anonymous};
 });
 return {items,updatedAt:data.updatedAt};
}
export async function fetchRecentWins(signal?:AbortSignal) {
 // Let StrictMode's abandoned mount cancel before it can issue an extra HTTP request.
 await Promise.resolve();
 if(signal?.aborted)throw signal.reason??new DOMException('Aborted','AbortError');
 const session=useSessionStore.getState().session;
 const body=session?{uid:session.uid,sid:session.sid}:{};
 return parseRecentWins(await request('/api/game/recent-wins',{method:'POST',signal,body:JSON.stringify(body)},t('recentWins.failed')));
}
export async function fetchRecentWinReplay(id:string) {
 const data=await request('/api/game/recent-wins/replay',{method:'POST',body:JSON.stringify({id})},t('gamePreview.replayUnavailable'));
 if(!isRecord(data)||typeof data.replayUrl!=='string')throw new Error(t('gamePreview.replayUnavailable'));
 const u=new URL(data.replayUrl);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.searchParams.get('replay')||u.searchParams.get('share')?.length!==52||u.searchParams.has('launchTicket'))throw new Error(t('gamePreview.replayUnavailable'));
 return u.href;
}
// This compact format is specific to the home broadcast; accounting remains integer cents.
export function recentWinMoney(cents:string) {
 const whole=BigInt(cents)/100n;
 if(whole<1000n)return 'Rp'+whole;
 const tenths=whole/100n;
 return 'Rp'+tenths/10n+'.'+tenths%10n+' k';
}
export function leaderboardRewardMoney(cents:string) {
 const whole=BigInt(cents)/100n;
 if(whole<1000n)return 'Rp'+whole;
 const thousands=whole/1000n;
 return 'Rp'+thousands+'k';
}
