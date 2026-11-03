import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export interface LedgerItem { id:string; orderId:string; type:string; currency:string; amount:number; balance:number; createdAt:string; remark:string }
export interface LedgerPage { items:LedgerItem[]; categories:{id:string;name:string}[]; nextCursor:string }
export function parseLedgerItem(value:unknown):LedgerItem {
 if(!isRecord(value)||!['id','orderId','type','currency','createdAt','remark'].every(key=>typeof value[key]==='string')||!Number.isSafeInteger(value.amount)||!Number.isSafeInteger(value.balance)||Number(value.balance)<0||!Number.isFinite(Date.parse(String(value.createdAt))))throw new Error('资金明细响应格式有误');
 return {id:String(value.id),orderId:String(value.orderId),type:String(value.type),currency:String(value.currency),amount:Number(value.amount),balance:Number(value.balance),createdAt:String(value.createdAt),remark:String(value.remark)};
}
async function call(path:string,fields:Record<string,string>,signal?:AbortSignal){const identity=await ensureSession();return request(path,{method:'POST',signal,body:JSON.stringify({uid:identity.uid,sid:identity.sid,...fields})},'资金明细暂时无法加载，请重试');}
export async function fetchLedger(from:string,to:string,category:string,cursor:string,signal?:AbortSignal):Promise<LedgerPage>{
 const data=await call('/api/game/wallet-ledger',{from,to,category,cursor},signal);
 if(!isRecord(data)||!Array.isArray(data.items)||!Array.isArray(data.categories)||typeof data.nextCursor!=='string')throw new Error('资金明细响应格式有误');
 const categories=data.categories.map((row:unknown)=>{if(!isRecord(row)||typeof row.id!=='string'||typeof row.name!=='string')throw new Error('资金分类格式有误');return {id:row.id,name:row.name};});
 return {items:data.items.map(parseLedgerItem),categories,nextCursor:data.nextCursor};
}
export async function fetchLedgerDetail(id:string,signal?:AbortSignal){const data=await call('/api/game/wallet-ledger/detail',{id},signal);if(!isRecord(data))throw new Error('交易详情格式有误');return parseLedgerItem(data.item);}
