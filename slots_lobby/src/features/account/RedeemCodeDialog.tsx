import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Button,Input,Modal,Space,message} from 'antd';
import {AsyncAntButton} from '../../components/buttons/AsyncButton';
import {overlayContainer} from '../../app/designViewport';
import {redeemCode} from '../../services/redeem-code';
import {t} from '../../i18n';
import {betMoney} from '../bet-records/money';

export function RedeemCodeDialog({onClose}:{onClose:()=>void}){
 const [code,setCode]=useState('');const [toast,holder]=message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});const client=useQueryClient();
 const mutation=useMutation({mutationFn:()=>redeemCode(code),retry:false,onSuccess:async result=>{if(result.alreadyRedeemed){void toast.error(t('redeem.alreadyRedeemed'));return;}await Promise.all([client.invalidateQueries({queryKey:['lobby','current-profile']}),client.invalidateQueries({queryKey:['wallet-ledger']}),client.invalidateQueries({queryKey:['personal-report']})]);setCode('');void toast.success(t('redeem.success',{amount:betMoney(result.amount)}));},onError:error=>{void toast.error(error instanceof Error?error.message:t('redeem.failed'));}});
 async function paste(){try{setCode(await navigator.clipboard.readText());}catch{void toast.error(t('redeem.pasteFailed'));}}
 return <>{holder}<Modal getContainer={overlayContainer} open centered title={t('redeem.title')} onCancel={()=>{if(!mutation.isPending)onClose();}} closable={!mutation.isPending} mask={{closable:!mutation.isPending}} keyboard={!mutation.isPending} footer={<AsyncAntButton type="primary" block loading={mutation.isPending} disabled={!code.trim()} onClick={()=>{if(!mutation.isPending&&code.trim())mutation.mutate();}}>{t('redeem.submit')}</AsyncAntButton>}>
 <label className="field-label" htmlFor="redeem-code-input">{t('redeem.inputLabel')}</label><Space.Compact block><Input id="redeem-code-input" autoFocus maxLength={64} value={code} disabled={mutation.isPending} onChange={event=>setCode(event.target.value)} onPressEnter={()=>{if(!mutation.isPending&&code.trim())mutation.mutate();}} placeholder={t('redeem.placeholder')}/><Button className="redeem-paste" disabled={mutation.isPending} onClick={()=>void paste()}>{t('redeem.paste')}</Button></Space.Compact>
 </Modal></>;
}
