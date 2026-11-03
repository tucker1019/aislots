import { useMemo, useSyncExternalStore } from 'react';
import { isRecord } from '../account/types';
export interface DepositIntent { tierId: string; requestId: string; orderId?: string }
const key = (uid: number) => `aislots-deposit-${uid}`;
export function readIntent(uid: number): DepositIntent | null {
 try {
  const v: unknown=JSON.parse(sessionStorage.getItem(key(uid))||'null');
  return isRecord(v)&&typeof v.tierId==='string'&&!!v.tierId&&typeof v.requestId==='string'&&!!v.requestId&&v.requestId.length<=128&&(v.orderId===undefined||typeof v.orderId==='string')
   ? {tierId:v.tierId,requestId:v.requestId,orderId:v.orderId as string|undefined}:null;
 } catch { return null; }
}
export function saveIntent(uid: number,intent: DepositIntent) {sessionStorage.setItem(key(uid),JSON.stringify(intent));window.dispatchEvent(new Event("deposit:intent"));}

export function clearIntent(uid: number) {sessionStorage.removeItem(key(uid));window.dispatchEvent(new Event("deposit:intent"));}

function subscribe(listener:()=>void){window.addEventListener('deposit:intent',listener);window.addEventListener('storage',listener);return ()=>{window.removeEventListener('deposit:intent',listener);window.removeEventListener('storage',listener);};}
export function useDepositIntent(uid:number){
 const raw=useSyncExternalStore(subscribe,()=>sessionStorage.getItem(key(uid)),()=>null);
 return useMemo(()=>{ void raw; return readIntent(uid); },[raw,uid]);
}
