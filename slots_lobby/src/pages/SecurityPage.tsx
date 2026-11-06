import {AsyncAntButton as Button} from '../components/buttons/AsyncButton';
import {useState} from 'react';
import {Form,Input,Modal,message} from 'antd';
import {RecordsLayout} from '../components/records/RecordsLayout';
import {Icon} from '../components/Icon';
import {overlayContainer} from '../app/designViewport';
import {navigateLobby} from '../app/useLobbyRoute';
import {changeLoginPassword,logoutSession} from '../services/security';
import {t} from '../i18n';
export function SecurityPage({password=false,onSignedOut}:{password?:boolean;onSignedOut:(changed:boolean)=>void}){
 const [confirm,setConfirm]=useState(false);const [busy,setBusy]=useState(false);
 const [toast,holder]=message.useMessage({getContainer:overlayContainer,top:'calc(var(--lobby-safe-top, 0px) + 12px)',maxCount:1,classNames:{list:'lobby-toast-list'}});
 const [form]=Form.useForm<{oldPassword:string;newPassword:string;confirmation:string}>();
 const run=async(action:()=>Promise<void>,changed:boolean)=>{if(busy)return;setBusy(true);try{await action();setConfirm(false);form.resetFields();onSignedOut(changed);}catch(error){void toast.error(error instanceof Error?error.message:t('security.failed'));}finally{setBusy(false);}};
 const rule={required:true,message:t('auth.passwordRule')};
 return <RecordsLayout title={t(password?'security.changeTitle':'security.title')} backLabel={t('copy.backToMyAccount')} onBack={()=>{if(!busy)navigateLobby(password?'security':'my');}} className="security-page">{holder}
 {password?<Form form={form} layout="vertical" disabled={busy} onFinish={values=>void run(()=>changeLoginPassword(values.oldPassword,values.newPassword),true)} onFinishFailed={({errorFields})=>void toast.error(errorFields[0]?.errors[0]??t('security.failed'))}>
 <Form.Item help="" name="oldPassword" label={t('security.oldPassword')} rules={[{required:true,message:t('security.oldRequired')}]}><Input.Password autoComplete="current-password" maxLength={72}/></Form.Item>
 <Form.Item help="" name="newPassword" label={t('security.newPassword')} dependencies={['oldPassword']} rules={[rule,{min:8,max:72,message:t('auth.passwordRule')},{validator:(_,value:unknown)=>typeof value==='string'&&new TextEncoder().encode(value).length<=72&&value!==form.getFieldValue('oldPassword')?Promise.resolve():Promise.reject(new Error(t('security.newRule')))}]}><Input.Password autoComplete="new-password" maxLength={72}/></Form.Item>
 <Form.Item help="" name="confirmation" label={t('auth.confirm')} dependencies={['newPassword']} rules={[{required:true,message:t('auth.confirmRule')},{validator:(_,value:unknown)=>value===form.getFieldValue('newPassword')?Promise.resolve():Promise.reject(new Error(t('auth.confirmRule')))}]}><Input.Password autoComplete="new-password" maxLength={72}/></Form.Item>
 <p className="security-note">{t('security.note')}</p><Button block type="primary" htmlType="submit" loading={busy}>{t('security.save')}</Button>
 </Form>:<><section className="account-card account-help"><button type="button" onClick={()=>navigateLobby('password')}><span>{t('security.loginPassword')}</span><Icon name="chevron" size={16}/></button></section><Button block onClick={()=>setConfirm(true)}>{t('auth.logout')}</Button></>}
 <Modal getContainer={overlayContainer} title={t('security.confirmTitle')} open={confirm} centered width={340} closable={!busy} maskClosable={!busy} keyboard={!busy} onCancel={()=>{if(!busy)setConfirm(false);}} footer={<div className="security-confirm-actions"><Button disabled={busy} onClick={()=>setConfirm(false)}>{t('security.cancel')}</Button><Button type="primary" loading={busy} onClick={()=>void run(logoutSession,false)}>{t('security.confirmLogout')}</Button></div>}><p>{t('security.confirmText')}</p></Modal>
 </RecordsLayout>;
}
