import {useMutation} from '@tanstack/react-query';
import {Alert,Button,Form,Input,Modal} from 'antd';
import {bindCustomAccount} from '../../services/account';
import {useProfileUpdate} from './useProfileUpdate';
import {t} from '../../i18n';
interface Fields{account:string;password:string;confirm:string}
export function BindAccount({uid,onClose}:{uid:number;onClose:()=>void}){
 const [form]=Form.useForm<Fields>();const update=useProfileUpdate();
 const bind=useMutation({mutationFn:({account,password}:Fields)=>bindCustomAccount(account,password),retry:false,onSuccess:async(_,values)=>{await update(uid,{account:values.account,nickname:values.account});form.resetFields();onClose();},onError:()=>{void update(uid,{});}});
 return <Modal open centered title={t('profile.bindAccount')} closable={!bind.isPending} mask={{closable:!bind.isPending}} keyboard={!bind.isPending} onCancel={()=>{form.resetFields();onClose();}} footer={<Button autoInsertSpace={false} type="primary" className="profile-bind-submit" disabled={bind.isPending} loading={bind.isPending} onClick={()=>form.submit()}>{t('profile.bind')}</Button>}>
 <Form form={form} layout="vertical" requiredMark={false} onFinish={values=>{if(!bind.isPending)bind.mutate(values);}} disabled={bind.isPending}>
 <Form.Item name="account" label={t('profile.account')} rules={[{required:true,message:t('profile.enterAccount')},{validator:(_,value:unknown)=>{if(typeof value!=='string')return Promise.resolve();const length=new TextEncoder().encode(value).length;return value===value.trim()&&length>=3&&length<=64?Promise.resolve():Promise.reject(new Error(t('profile.accountInvalid')));}}]}><Input autoComplete="username" placeholder={t('profile.enterAccount')}/></Form.Item>
 <Form.Item name="password" label={t('profile.password')} rules={[{required:true,message:t('profile.enterPassword')},{validator:(_,value:unknown)=>{if(typeof value!=='string')return Promise.resolve();const length=new TextEncoder().encode(value).length;return length>=8&&length<=72?Promise.resolve():Promise.reject(new Error(t('profile.passwordInvalid')));}}]}><Input.Password autoComplete="new-password" placeholder={t('profile.enterPassword')}/></Form.Item>
 <Form.Item name="confirm" label={t('profile.confirmPassword')} dependencies={['password']} rules={[{required:true,message:t('profile.confirmPassword')},{validator:(_,value:unknown)=>value===form.getFieldValue('password')?Promise.resolve():Promise.reject(new Error(t('profile.passwordMismatch')))}]}><Input.Password autoComplete="new-password"/></Form.Item>
 </Form>{bind.isError&&<Alert type="error" showIcon title={bind.error.message}/>}
 </Modal>;
}
