import {LoadingState} from '../../components/feedback/LoadingState';
import { t, getLocale } from '../../i18n';
import { coinsLabel } from '../account/formatCoins';
import { paymentLink } from '../../services/recharge';
import type { RechargeOrder } from '../../services/recharge';
export function OrderPanel({order,loading,error,onRefresh}:{order?:RechargeOrder;loading:boolean;error:boolean;onRefresh:()=>void}) {
 if(!order) return <section className="deposit-card" aria-label={t('copy.depositOrder')}>{error?<p role="alert">{t('copy.orderStatusIsUnavailablePleaseRetry')}</p>:<LoadingState compact label={t('copy.checkingOrderStatus')}/>}<button type="button" disabled={loading} onClick={onRefresh}>{t('copy.refreshOrderStatus')}</button></section>;
 const url=paymentLink(order.paymentUrl);
 return <section className="deposit-card deposit-order" aria-label={t('copy.depositOrder')}>
  <div className={`order-status status-${order.status}`}><span aria-hidden="true">{order.status==='success'?'✓':order.status==='failed'?'!':'◷'}</span><h2>{order.status==='success'?t('copy.depositSuccessful'):order.status==='failed'?t('copy.depositFailed'):t('copy.awaitingPaymentConfirmation')}</h2></div>
  <p>{order.status==='success'?t('copy.creditedValue', {p0: coinsLabel(order.creditAmount)}):order.status==='failed'?t('copy.thisOrderWasNotCreditedPleaseCreate'):t('copy.yourBalanceWillUpdateWhenTheOrder')}</p>
  <dl><div><dt>{t('copy.orderNumber')}</dt><dd>{order.orderId}</dd></div><div><dt>{t('copy.depositPrincipal')}</dt><dd>{coinsLabel(order.amount)}</dd></div><div><dt>{t('copy.createdAt')}</dt><dd>{new Date(order.createdAt).toLocaleString(getLocale())}</dd></div></dl>
  {error&&<p role="alert">{t('copy.statusUpdateFailedPleaseRefreshToConfirm')}</p>}
  {order.status==='pending'&&url&&<a className="deposit-payment" href={url} target="_blank" rel="noopener noreferrer">{t('copy.openPaymentPage')}</a>}
  <button type="button" disabled={loading} onClick={onRefresh}>{loading?t('copy.checking'):t('copy.refreshOrderStatus')}</button>
 </section>;
}
