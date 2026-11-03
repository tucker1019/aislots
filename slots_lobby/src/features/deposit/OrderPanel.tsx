import { coinsLabel } from '../account/formatCoins';
import { paymentLink } from '../../services/recharge';
import type { RechargeOrder } from '../../services/recharge';
export function OrderPanel({order,loading,error,onRefresh}:{order?:RechargeOrder;loading:boolean;error:boolean;onRefresh:()=>void}) {
 if(!order) return <section className="deposit-card" aria-label="充值订单"><p role={error?'alert':'status'}>{error?'暂时无法查询订单状态，请重试':'正在查询订单状态…'}</p><button type="button" disabled={loading} onClick={onRefresh}>刷新订单状态</button></section>;
 const url=paymentLink(order.paymentUrl);
 return <section className="deposit-card deposit-order" aria-label="充值订单">
  <div className={`order-status status-${order.status}`}><span aria-hidden="true">{order.status==='success'?'✓':order.status==='failed'?'!':'◷'}</span><h2>{order.status==='success'?'存款成功':order.status==='failed'?'存款失败':'等待付款确认'}</h2></div>
  <p>{order.status==='success'?`已到账 ${coinsLabel(order.creditAmount)}`:order.status==='failed'?'本次订单未入账，请重新创建订单。':'订单确认后将自动更新余额。'}</p>
  <dl><div><dt>订单号</dt><dd>{order.orderId}</dd></div><div><dt>存款金额</dt><dd>{coinsLabel(order.amount)}</dd></div><div><dt>创建时间</dt><dd>{new Date(order.createdAt).toLocaleString('zh-CN')}</dd></div></dl>
  {error&&<p role="alert">状态更新失败，请手动刷新确认。</p>}
  {order.status==='pending'&&url&&<a className="deposit-payment" href={url} target="_blank" rel="noopener noreferrer">打开付款页面 ↗</a>}
  <button type="button" disabled={loading} onClick={onRefresh}>{loading?'查询中…':'刷新订单状态'}</button>
 </section>;
}
