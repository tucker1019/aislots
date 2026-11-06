import {AsyncAntButton as Button} from '../../components/buttons/AsyncButton';
import {useState} from 'react';
import {Modal,Form,Input,message,Tabs} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {useAuthStore} from '../../stores/auth';
import {authenticateAccount} from '../../services/account';
import {t} from '../../i18n';
export function AuthModal(){
 const auth=useAuthStore();const [busy,setBusy]=useState(false);const [toast,holder]=message.useMessage({getContainer:overlayContainer,top:'calc(var(--lobby-safe-top, 0px) + 12px)',maxCount:1,classNames:{list:'lobby-toast-list'}});const [form]=Form.useForm<{account:string;password:string;confirm:string}>();
 const close=()=>{if(busy)return;auth.close();form.resetFields();toast.destroy();};
 const submit=async(values:{account:string;password:string})=>{if(busy)return;setBusy(true);toast.destroy();try{const resume=auth.resume;await authenticateAccount(auth.mode,values.account,values.password);auth.close();form.resetFields();resume?.();}catch(e){void toast.error({key:'auth-error',content:e instanceof Error?e.message:t('auth.failed')});}finally{setBusy(false);}};
 return <>{holder}<Modal getContainer={overlayContainer} open={auth.open} title={t('auth.title')} footer={null} centered width={360} className="auth-modal" onCancel={close} closable={!busy} maskClosable={!busy} keyboard={!busy}>
 <Tabs activeKey={auth.mode} onChange={mode=>{if(busy)return;useAuthStore.setState({mode:mode==='register'?'register':'login'});toast.destroy();form.resetFields();}} items={[{key:'login',label:t('auth.login'),disabled:busy},{key:'register',label:t('auth.register'),disabled:busy}]}/>
 <Form form={form} layout="vertical" onFinish={values=>void submit(values)} onFinishFailed={({errorFields})=>{void toast.error({key:'auth-error',content:errorFields[0]?.errors[0]??t('auth.failed')});}} disabled={busy}>
 <div className="auth-fields">
 <Form.Item help="" name="account" label={t('auth.account')} rules={[{required:true,message:t('auth.accountRule')},{min:3,max:64,message:t('auth.accountRule')},{validator:(_,value:unknown)=>typeof value==='string'&&value===value.trim()?Promise.resolve():Promise.reject(new Error(t('auth.accountRule')))}]}><Input autoComplete="username" maxLength={64}/></Form.Item>
 <Form.Item help="" name="password" label={t('auth.password')} rules={[{required:true,message:t('auth.passwordRule')},{min:8,max:72,message:t('auth.passwordRule')},{validator:(_,value:unknown)=>typeof value==='string'&&new TextEncoder().encode(value).length<=72?Promise.resolve():Promise.reject(new Error(t('auth.passwordRule')))}]}><Input.Password autoComplete={auth.mode==='register'?'new-password':'current-password'} maxLength={72}/></Form.Item>
 {auth.mode==='register'?<Form.Item help="" name="confirm" label={t('auth.confirm')} dependencies={['password']} rules={[{required:true,message:t('auth.confirmRule')},{validator:(_,value:unknown)=>value===form.getFieldValue('password')?Promise.resolve():Promise.reject(new Error(t('auth.confirmRule')))}]}><Input.Password autoComplete="new-password"/></Form.Item>:<div aria-hidden="true"/>}
 </div><Button block type="primary" htmlType="submit" loading={busy}>{t(auth.mode==='register'?'auth.register':'auth.login')}</Button>
 </Form></Modal></>;
}
