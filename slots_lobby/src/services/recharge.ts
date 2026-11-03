import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export interface RechargeTier { id: string; amount: number; bonus: number; fee: number; creditAmount: number }
export type OrderStatus = 'pending' | 'success' | 'failed';
export interface RechargeReceipt { orderId: string; paymentUrl: string; status: OrderStatus }
export interface RechargeOrder extends RechargeReceipt { amount: number; bonus: number; fee: number; creditAmount: number; createdAt: string }
const money = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function amounts(v: Record<string, unknown>) {
 return money(v.amount) && v.amount > 0 && money(v.bonus) && money(v.fee) && v.fee < v.amount &&
  !(v.bonus > 0 && v.fee > 0) && money(v.creditAmount) && v.creditAmount === v.amount + v.bonus - v.fee;
}
export function parseTiers(value: unknown): RechargeTier[] {
 if (!isRecord(value) || !Array.isArray(value.items)) throw new Error('充值档位格式有误');
 const ids = new Set<string>();
 return value.items.map((v: unknown) => {
  if (!isRecord(v) || typeof v.id !== 'string' || !v.id || ids.has(v.id) || !amounts(v)) throw new Error('充值档位格式有误');
  ids.add(v.id);
  return { id:v.id,amount:Number(v.amount),bonus:Number(v.bonus),fee:Number(v.fee),creditAmount:Number(v.creditAmount) };
 });
}
function receipt(value: unknown): RechargeReceipt {
 if (!isRecord(value) || typeof value.orderId !== 'string' || !value.orderId || typeof value.paymentUrl !== 'string' ||
   (typeof value.status !== 'string' || !['pending','success','failed'].includes(value.status))) throw new Error('订单响应格式有误，请重试');
 return {orderId:value.orderId,paymentUrl:value.paymentUrl,status:value.status as OrderStatus};
}
export function paymentLink(value: string): string | undefined {
 try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:undefined;} catch {return undefined;}
}
async function identityParams(expectedUid?: number) { const s=await ensureSession();if(expectedUid!==undefined&&s.uid!==expectedUid)throw new Error('账号已变化，请重新操作');return new URLSearchParams({uid:String(s.uid),sid:s.sid}); }
export async function fetchRechargeTiers(signal?: AbortSignal) {
 const params=await identityParams();return parseTiers(await request('/api/recharge/list?'+params,{signal},'充值档位加载失败，请重试'));
}
export async function createRecharge(tierId: string,requestId: string,expectedUid?: number): Promise<RechargeReceipt> {
 const s=await ensureSession();if(expectedUid!==undefined&&s.uid!==expectedUid)throw new Error('账号已变化，请重新操作');return receipt(await request('/api/recharge/create',{method:'POST',body:JSON.stringify({uid:s.uid,sid:s.sid,tierId,requestId})},'订单提交未确认，请重试同一订单'));
}
export async function fetchRechargeOrder(orderId: string,signal?: AbortSignal,expectedUid?: number): Promise<RechargeOrder> {
 const params=await identityParams(expectedUid);params.set('orderId',orderId);
 const value=await request('/api/recharge/order/info?'+params,{signal},'订单状态查询失败，请重试');
 return parseRechargeOrder(value,orderId);
}
export function parseRechargeOrder(value: unknown,expectedId?: string): RechargeOrder {
 const base=receipt(value);
 if (!isRecord(value)||(expectedId!==undefined&&base.orderId!==expectedId)||!amounts(value)||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))) throw new Error('订单详情格式有误');
 return {...base,amount:Number(value.amount),bonus:Number(value.bonus),fee:Number(value.fee),creditAmount:Number(value.creditAmount),createdAt:value.createdAt};
}
