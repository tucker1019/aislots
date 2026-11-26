import {AsyncAntButton as Button} from '../../components/buttons/AsyncButton';
import {useState} from 'react';
import {Modal,Form,Input,message,Tabs,Divider} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {useAuthStore} from '../../stores/auth';
import {authenticateAccount} from '../../services/account';
import {loginWithGoogle} from '../../services/google-auth';
import {loginWithTelegram} from '../../services/telegram-auth';
import {t} from '../../i18n';
export function AuthModal(){
 const auth=useAuthStore();const [busy,setBusy]=useState(false);const [googleBusy,setGoogleBusy]=useState(false);const [tgBusy,setTgBusy]=useState(false);const [toast,holder]=message.useMessage({getContainer:overlayContainer,top:'calc(var(--lobby-safe-top, 0px) + 12px)',maxCount:1,classNames:{list:'lobby-toast-list'}});const [form]=Form.useForm<{account:string;password:string;confirm:string}>();
 const anyBusy=busy||googleBusy||tgBusy;
 const close=()=>{if(anyBusy)return;auth.close();form.resetFields();toast.destroy();};
 const submit=async(values:{account:string;password:string})=>{if(anyBusy)return;setBusy(true);toast.destroy();try{const resume=auth.resume;await authenticateAccount(auth.mode,values.account,values.password);auth.close();form.resetFields();resume?.();}catch(e){void toast.error({key:'auth-error',content:e instanceof Error?e.message:t('auth.failed')});}finally{setBusy(false);}};
 const handleGoogleLogin=async()=>{if(anyBusy)return;setGoogleBusy(true);toast.destroy();try{const resume=auth.resume;await loginWithGoogle();auth.close();form.resetFields();resume?.();}catch(e){void toast.error({key:'auth-error',content:e instanceof Error?e.message:t('auth.failed')});}finally{setGoogleBusy(false);}};
 const handleTelegramLogin=async()=>{if(anyBusy)return;setTgBusy(true);toast.destroy();try{const resume=auth.resume;await loginWithTelegram();auth.close();form.resetFields();resume?.();}catch(e){void toast.error({key:'auth-error',content:e instanceof Error?e.message:t('auth.failed')});}finally{setTgBusy(false);}};
 return <>{holder}<Modal getContainer={overlayContainer} open={auth.open} title={t('auth.title')} footer={null} centered width={360} className="auth-modal" onCancel={close} closable={!anyBusy} maskClosable={!anyBusy} keyboard={!anyBusy}>
 <Tabs activeKey={auth.mode} onChange={mode=>{if(anyBusy)return;useAuthStore.setState({mode:mode==='register'?'register':'login'});toast.destroy();form.resetFields();}} items={[{key:'login',label:t('auth.login'),disabled:anyBusy},{key:'register',label:t('auth.register'),disabled:anyBusy}]}/>
 <Form form={form} layout="vertical" onFinish={values=>void submit(values)} onFinishFailed={({errorFields})=>{void toast.error({key:'auth-error',content:errorFields[0]?.errors[0]??t('auth.failed')});}} disabled={anyBusy}>
 <div className="auth-fields">
 <Form.Item help="" name="account" label={t('auth.account')} rules={[{required:true,message:t('auth.accountRule')},{min:3,max:64,message:t('auth.accountRule')},{validator:(_,value:unknown)=>typeof value==='string'&&value===value.trim()?Promise.resolve():Promise.reject(new Error(t('auth.accountRule')))}]}><Input autoComplete="username" maxLength={64}/></Form.Item>
 <Form.Item help="" name="password" label={t('auth.password')} rules={[{required:true,message:t('auth.passwordRule')},{min:8,max:72,message:t('auth.passwordRule')},{validator:(_,value:unknown)=>typeof value==='string'&&new TextEncoder().encode(value).length<=72?Promise.resolve():Promise.reject(new Error(t('auth.passwordRule')))}]}><Input.Password autoComplete={auth.mode==='register'?'new-password':'current-password'} maxLength={72}/></Form.Item>
 {auth.mode==='register'?<Form.Item help="" name="confirm" label={t('auth.confirm')} dependencies={['password']} rules={[{required:true,message:t('auth.confirmRule')},{validator:(_,value:unknown)=>value===form.getFieldValue('password')?Promise.resolve():Promise.reject(new Error(t('auth.confirmRule')))}]}><Input.Password autoComplete="new-password"/></Form.Item>:<div aria-hidden="true"/>}
 </div><Button block type="primary" htmlType="submit" loading={busy} disabled={googleBusy}>{t(auth.mode==='register'?'auth.register':'auth.login')}</Button>
 </Form>
 <Divider plain style={{margin:'14px 0 12px',borderColor:'var(--theme-border)',color:'var(--theme-muted)',fontSize:12}}>{t('auth.orContinueWith')}</Divider>
 <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:20}}>
 <Button shape="circle" size="large" loading={googleBusy} disabled={busy||tgBusy} aria-label={t('auth.continueWithGoogle')} onClick={()=>void handleGoogleLogin()} style={{width:44,height:44,padding:0,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#ffffff',borderColor:'var(--theme-border)'}} icon={googleBusy?undefined:<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3.02c-1.07.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.11-6.7-4.94H1.29v3.11A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.28A7.2 7.2 0 0 1 4.92 12c0-.79.14-1.56.38-2.28V6.61H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4.01-3.11z"/><path fill="#EA4335" d="M12 4.78c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4.01 3.11C6.24 6.89 8.88 4.78 12 4.78z"/></svg>}/>
 <Button shape="circle" size="large" loading={tgBusy} disabled={busy||googleBusy} aria-label={t('auth.continueWithTelegram')} onClick={()=>void handleTelegramLogin()} style={{width:44,height:44,padding:0,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#229ED9',borderColor:'#229ED9',color:'#ffffff'}} icon={tgBusy?undefined:<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ffffff" d="M21.94 4.24c.2-.92-.34-1.28-.96-1.05L2.48 10.33c-.86.34-.85.83-.15 1.04l4.74 1.48 11-6.94c.52-.32 1-.14.6.2l-8.9 8.03-.33 4.86c.48 0 .69-.22.96-.48l2.31-2.24 4.8 3.55c.88.49 1.52.24 1.74-.82l3.15-14.77z"/></svg>}/>
 </div>
 </Modal></>;
}
