import {ensureSession,request} from './account';
import {isRecord} from '../features/account/types';
import {t,getLocale} from '../i18n';
export type RtpWindow='5m'|'1h'|'24h';
export type RankBoard='wins'|'multiplier'|'streak';
export type RankPeriod='today'|'week'|'all';
export interface GameRtp {percent:string;rounds:number;hasData:boolean;from:string;to:string;updatedAt:string;statisticsSince:string}
export interface LeaderboardRow {rank:number;platformOrderId:string;userId:string;nickname:string;avatarId:number;betId:string;betAmount:string;winAmount:string;multiplier:string;streak:number;occurredAt:string}
export interface GameLeaderboard {items:LeaderboardRow[];updatedAt:string;statisticsSince:string;timezone:string}
const integer=(value:unknown):value is string=>typeof value==='string'&&/^\d+$/.test(value);
const decimal=(value:unknown):value is string=>typeof value==='string'&&/^\d+(\.\d+)?$/.test(value);
const instant=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function parseGameRtp(data:unknown):GameRtp{
 if(!isRecord(data)||!decimal(data.percent)||!Number.isSafeInteger(data.rounds)||Number(data.rounds)<0||typeof data.hasData!=='boolean'||!['from','to','updatedAt','statisticsSince'].every(key=>instant(data[key])))throw new Error(t('statistics.invalid'));
 return {percent:data.percent,rounds:Number(data.rounds),hasData:data.hasData,from:String(data.from),to:String(data.to),updatedAt:String(data.updatedAt),statisticsSince:String(data.statisticsSince)};
}
export function parseLeaderboard(data:unknown):GameLeaderboard{
 if(!isRecord(data)||!Array.isArray(data.items)||data.items.length>20||!instant(data.updatedAt)||!instant(data.statisticsSince)||typeof data.timezone!=='string')throw new Error(t('statistics.invalid'));
 const items=data.items.map((row:unknown):LeaderboardRow=>{
  if(!isRecord(row)||!integer(row.platformOrderId)||/^0+$/.test(row.platformOrderId)||!Number.isInteger(row.rank)||Number(row.rank)<1||typeof row.userId!=='string'||typeof row.nickname!=='string'||!Number.isInteger(row.avatarId)||Number(row.avatarId)<1||Number(row.avatarId)>15||typeof row.betId!=='string'||!integer(row.betAmount)||!integer(row.winAmount)||!decimal(row.multiplier)||!Number.isSafeInteger(row.streak)||Number(row.streak)<0||!instant(row.occurredAt))throw new Error(t('statistics.invalid'));
  return {platformOrderId:String(row.platformOrderId),rank:Number(row.rank),userId:row.userId,nickname:row.nickname,avatarId:Number(row.avatarId),betId:row.betId,betAmount:row.betAmount,winAmount:row.winAmount,multiplier:row.multiplier,streak:Number(row.streak),occurredAt:row.occurredAt};
 });return {items,updatedAt:data.updatedAt,statisticsSince:data.statisticsSince,timezone:data.timezone};
}
async function load(path:string,fields:Record<string,string>,signal?:AbortSignal,gameId='AG1'){const identity=await ensureSession();return request(path,{method:'POST',signal,body:JSON.stringify({uid:identity.uid,sid:identity.sid,gameId,...fields})},t('statistics.failed'));}
export async function fetchGameRtp(window:RtpWindow,signal?:AbortSignal,gameId='AG1'){return parseGameRtp(await load('/api/game/rtp',{window},signal,gameId));}
export async function fetchLeaderboard(board:RankBoard,period:RankPeriod,signal?:AbortSignal,gameId='AG1'){return parseLeaderboard(await load('/api/game/leaderboard',{board,period},signal,gameId));}
export function statisticsMoney(value:string){const number=BigInt(value),absolute=number<0n?-number:number;const formatter=new Intl.NumberFormat(getLocale());const decimal=formatter.formatToParts(1.1).find(part=>part.type==='decimal')?.value??'.';return (number<0n?'-':'')+formatter.format(absolute/100n)+decimal+String(absolute%100n).padStart(2,'0');}

export async function fetchRankReplay(platformOrderId:string,board:RankBoard,period:RankPeriod,gameId='AG1'){
 const data=await load('/api/game/rank-replay',{platformOrderId,board,period},undefined,gameId);
 if(!isRecord(data)||typeof data.replayUrl!=='string')throw new Error(t('gamePreview.replayUnavailable'));
 const url=new URL(data.replayUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.searchParams.get('replay')||url.searchParams.get('share')?.length!==52||url.searchParams.has('launchTicket'))throw new Error(t('gamePreview.replayUnavailable'));
 return url.href;
}
