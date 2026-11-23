import {ensureSession,request} from './account';
import {isRecord} from '../features/account/types';
import {t} from '../i18n';

export async function redeemCode(code:string){
 const identity=await ensureSession();
 const data=await request('/api/user/redeem-code',{method:'POST',body:JSON.stringify({uid:identity.uid,sid:identity.sid,code:code.trim()})},t('redeem.failed'));
 if(!isRecord(data)||!Number.isSafeInteger(data.amount)||Number(data.amount)<=0||!Number.isSafeInteger(data.coins)||Number(data.coins)<0)throw new Error(t('redeem.failed'));
 return {amount:Number(data.amount),coins:Number(data.coins)};
}
