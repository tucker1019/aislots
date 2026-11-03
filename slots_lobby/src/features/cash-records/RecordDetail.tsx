import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRechargeOrder } from '../../services/recharge';
import { useAccountProfile } from '../account/useAccountProfile';
import { coinsLabel } from '../account/formatCoins';
import { RecordsLayout } from '../../components/records/RecordsLayout';
export function RecordDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const profile = useAccountProfile();
  const order = useQuery({ queryKey: ['recharge-order', profile.data?.uid, orderId], enabled: !!profile.data,
    queryFn: ({ signal }) => fetchRechargeOrder(orderId, signal), retry: false,
    refetchInterval: query => query.state.data?.status === 'pending' ? 3000 : false });
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const data = order.data;
  const client = useQueryClient();
  useEffect(() => { if (data?.status === 'success') void client.invalidateQueries({ queryKey: ['lobby', 'current-profile'] }); }, [data?.status, client]);
  async function copy() {
    if (copying || !data) return;
    setCopying(true); setCopyError('');
    try { await navigator.clipboard.writeText(data.orderId); setCopied(true); }
    catch { setCopyError('复制失败，请长按订单号复制'); }
    finally { setCopying(false); }
  }
  const failed = profile.isError || order.isError;
  return <RecordsLayout title="存款详情" backLabel="返回存取记录" onBack={onBack}>
    {failed ? <section className="cash-records-feedback" role="alert"><p>存款详情加载失败，请重试。</p><button type="button" disabled={profile.isFetching || order.isFetching}
      onClick={() => { if (profile.isError) void profile.refetch(); else void order.refetch(); }}>重新加载</button></section>
      : !data ? <p className="cash-records-feedback" role="status">正在加载存款详情…</p>
      : <article className="cash-receipt">
        <div className="cash-receipt-summary"><span>充值金额</span><strong>+{coinsLabel(data.amount)}</strong>
          <p className={`cash-status-${data.status}`}>{data.status === 'success' ? '✓ 交易成功' : data.status === 'failed' ? '交易失败' : '等待付款确认'}</p></div>
        <dl>
          <div><dt>交易方式</dt><dd>测试支付</dd></div>
          <div><dt>手续费</dt><dd>{coinsLabel(data.fee)}</dd></div>
          {data.bonus > 0 && <div><dt>赠送金额</dt><dd>{coinsLabel(data.bonus)}</dd></div>}
          <div><dt>{data.status === 'pending' ? '预计到账' : '实际到账'}</dt><dd className="cash-receipt-credit">{coinsLabel(data.status === 'failed' ? 0 : data.creditAmount)}</dd></div>
          <div><dt>交易时间</dt><dd>{new Date(data.createdAt).toLocaleString('zh-CN', { hour12: false })}</dd></div>
          <div className="cash-receipt-order"><dt>订单号</dt><dd><span>{data.orderId}</span><button type="button" disabled={copying} onClick={() => { void copy(); }}>{copied ? '已复制' : '复制'}</button></dd></div>
          <div><dt>备注</dt><dd>—</dd></div>
        </dl>
        {copyError && <p role="status" className="cash-copy-error">{copyError}</p>}
      </article>}
  </RecordsLayout>;
}
