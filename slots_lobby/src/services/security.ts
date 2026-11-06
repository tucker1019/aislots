import {ensureSession,request} from './account';
import {isRecord} from '../features/account/types';
import {t} from '../i18n';
async function securityAction(path:string,values:Record<string,string>={}){
 const identity=await ensureSession();
 const data=await request('/api/user/account/'+path,{method:'POST',body:JSON.stringify({uid:identity.uid,sid:identity.sid,...values})},t('security.failed'));
 if(!isRecord(data)||data.success!==true)throw new Error(t('security.failed'));
}
export const changeLoginPassword=(oldPassword:string,newPassword:string)=>securityAction('password/update',{oldPassword,newPassword});
export const logoutSession=()=>securityAction('logout');
