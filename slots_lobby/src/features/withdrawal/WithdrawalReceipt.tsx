import {AsyncAntButton as Button} from '../../components/buttons/AsyncButton';
import {LoadingState} from '../../components/feedback/LoadingState';
import {NetworkError} from '../../components/feedback/NetworkError';
import {useRef,useState} from 'react';
import {Alert,Modal} from 'antd';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {fetchWithdrawal,reviewWithdrawal} from '../../services/withdrawal';
import {useSessionStore} from '../../stores/session';
import {betMoney} from '../bet-records/money';
import {t,getLocale} from '../../i18n';
export function WithdrawalReceipt({orderId}:{orderId:string}){
 const confirming=useRef(false);const [reviewOpen,setReviewOpen]=useState(false);
 const uid=useSessionStore(s=>s.session?.uid),client=useQueryClient();const [modal,holder]=Modal.useModal();
 const key=['withdrawal-order',uid,orderId];const query=useQuery({queryKey:key,queryFn:({signal})=>fetchWithdrawal(orderId,signal),retry:false,refetchInterval:q=>q.state.data?.status==='pending'?3000:false});
 const mutation=useMutation({mutationFn:(decision:'approve'|'return')=>reviewWithdrawal(orderId,decision),onSuccess:order=>{client.setQueryData(key,order);for(const queryKey of [['lobby','current-profile'],['cash-records'],['wallet-ledger'],['personal-report']])void client.invalidateQueries({queryKey});}});
 async function review(decision:'approve'|'return'){if(confirming.current||mutation.isPending)return;confirming.current=true;setReviewOpen(true);try{const confirmed=await modal.confirm({title:t(decision==='approve'?'withdrawal.approveConfirm':'withdrawal.returnConfirm'),okText:t('withdrawal.confirm'),cancelText:t('withdrawal.cancel')});if(confirmed)mutation.mutate(decision);}finally{confirming.current=false;setReviewOpen(false);}}
 const data=query.data;
 if(query.isPending)return <LoadingState/>;
 if(!data)return <NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>;
 return <>{holder}<article className="cash-receipt"><div className="cash-receipt-summary"><span>{t('withdrawal.amount')}</span><strong>{betMoney(data.amount)}</strong><p className={`cash-status-${data.status}`}>{t(`withdrawal.status.${data.status}`)}</p></div><dl>{[[t('withdrawal.debit'),betMoney(data.amount)],[t('copy.fee'),betMoney(data.fee)],[t('withdrawal.payout'),betMoney(data.status==='failed'?0:data.creditAmount)],[t('withdrawal.bonus'),betMoney(data.status==='failed'?0:data.bonus)],[t('withdrawal.channel'),data.channel],[t('wallet.account'),data.account],[t('wallet.name'),data.name],[t('copy.orderNumber'),data.orderId],[t('copy.transactionTime'),new Date(data.createdAt).toLocaleString(getLocale())]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{data.status==='failed'&&<p>{t('withdrawal.refunded')}</p>}
 {data.status==='pending'&&data.testMode&&<div className="withdrawal-review"><Button disabled={mutation.isPending||reviewOpen} loading={mutation.isPending&&mutation.variables==='approve'} onClick={()=>void review('approve')}>{t('withdrawal.approve')}</Button><Button loading={mutation.isPending&&mutation.variables==='return'} danger disabled={mutation.isPending||reviewOpen} onClick={()=>void review('return')}>{t('withdrawal.return')}</Button></div>}
 {mutation.isError&&<Alert type="error" title={t('withdrawal.requestFailed')}/>}
 {query.isError&&<Alert type="warning" title={t('withdrawal.requestFailed')} action={<Button loading={query.isFetching} onClick={()=>void query.refetch()}>{t('copy.retry')}</Button>}/>}</article></>;
}
