import { overlayContainer } from '../../app/designViewport';
import {LoadingState} from '../../components/feedback/LoadingState';
import {NetworkError} from '../../components/feedback/NetworkError';
import { serverText, t, getLocale } from '../../i18n';
import { RecordsLayout } from '../../components/records/RecordsLayout';
import { useQuery } from '@tanstack/react-query';
import { message } from 'antd';
import { fetchLedgerDetail } from '../../services/wallet-ledger';
import { useSessionStore } from '../../stores/session';
import { betMoney } from '../bet-records/money';
import { Icon } from '../../components/Icon';
export function LedgerDetail({id,onBack}:{id:string;onBack:()=>void}){
 const uid=useSessionStore(state=>state.session?.uid);
 const query=useQuery({queryKey:['wallet-ledger-detail',uid,id],queryFn:({signal})=>fetchLedgerDetail(id,signal),retry:false});
 const [toast,holder]=message.useMessage({getContainer:overlayContainer});const row=query.data;
 const copy=async()=>{try{await navigator.clipboard.writeText(row?.orderId??'');void toast.success(t('copy.orderNumberCopied'));}catch{void toast.error(t('copy.copyFailedPressAndHoldTheOrder'));}};
 return <RecordsLayout title={t('copy.transactionDetails')} backLabel={t('copy.backToWalletTransactions')} onBack={onBack}>{holder}
 {query.isPending?<LoadingState label={t('copy.loadingDetails')}/>:!row?<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>:<>
 <div className={`ledger-detail-amount ${row.amount<0?'bet-loss':'bet-gain'}`}>{row.amount>0?'+':''}{betMoney(row.amount)} <small>{row.currency}</small></div>
 <dl className="ledger-detail-fields"><div><dt>{t('copy.transactionType')}</dt><dd>{serverText(row.type)}</dd></div><div><dt>{t('copy.currency')}</dt><dd>{row.currency}</dd></div><div><dt>{t('copy.transactionTime')}</dt><dd>{new Date(row.createdAt).toLocaleString(getLocale(),{hour12:false})}</dd></div><div><dt>{t('copy.orderNumber')}</dt><dd className="ledger-order-id"><span>{row.orderId}</span><button type="button" aria-label={t('copy.copyOrderNumber')} onClick={()=>void copy()}><Icon name="list" size={16}/></button></dd></div><div><dt>{t('copy.balanceAfterTransaction')}</dt><dd>{betMoney(row.balance)}</dd></div><div><dt>{t('copy.notes')}</dt><dd>{serverText(row.remark||'—')}</dd></div></dl>
 </>}
 </RecordsLayout>;
}
