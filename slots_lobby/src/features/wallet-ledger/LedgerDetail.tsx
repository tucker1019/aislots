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
 const [toast,holder]=message.useMessage();const row=query.data;
 const copy=async()=>{try{await navigator.clipboard.writeText(row?.orderId??'');void toast.success('订单号已复制');}catch{void toast.error('复制失败，请长按订单号复制');}};
 return <RecordsLayout title="交易详情" backLabel="返回资金明细" onBack={onBack}>{holder}
 {query.isPending?<p className="cash-records-feedback" role="status">正在加载详情…</p>:!row?<div className="cash-records-feedback" role="alert"><p>交易详情加载失败</p><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>重试</button></div>:<>
 <div className={`ledger-detail-amount ${row.amount<0?'bet-loss':'bet-gain'}`}>{row.amount>0?'+':''}{betMoney(row.amount)} <small>{row.currency}</small></div>
 <dl className="ledger-detail-fields"><div><dt>账变类型</dt><dd>{row.type}</dd></div><div><dt>币种</dt><dd>{row.currency}</dd></div><div><dt>交易时间</dt><dd>{new Date(row.createdAt).toLocaleString('zh-CN',{hour12:false})}</dd></div><div><dt>订单号</dt><dd className="ledger-order-id"><span>{row.orderId}</span><button type="button" aria-label="复制订单号" onClick={()=>void copy()}><Icon name="list" size={16}/></button></dd></div><div><dt>账变后余额</dt><dd>{betMoney(row.balance)}</dd></div><div><dt>备注</dt><dd>{row.remark||'—'}</dd></div></dl>
 </>}
 </RecordsLayout>;
}
