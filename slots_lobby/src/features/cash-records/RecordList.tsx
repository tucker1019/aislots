import { t, getLocale } from '../../i18n';
import { Icon } from '../../components/Icon';
import { coinsLabel } from '../account/formatCoins';
import type { RechargeOrder } from '../../services/recharge';
const orderStatusLabels = () => ({ pending: t('copy.pendingConfirmation'), success: t('copy.orderSuccessful'), failed: t('copy.orderFailed') } as const);
export function RecordList({ items, onOpen }: { items: RechargeOrder[]; onOpen: (id: string) => void }) {
  if (!items.length) return <section className="cash-records-empty" aria-label={t('copy.noData')}>
    <span className="cash-empty-art" aria-hidden="true"><Icon name="list" size={48} /><span>◷</span></span>
    <p>{t('copy.noData')}</p>
  </section>;
  return <div className="cash-records-list" aria-label={t('copy.depositRecords')}>{items.map(item => <button type="button" className="cash-record-row" key={item.orderId}
    aria-label={item.kind==='withdrawal'?t('withdrawal.recordLabel',{amount:coinsLabel(item.amount),status:t(`withdrawal.status.${item.status}`)}):t('copy.viewDepositValueValue', {p0: coinsLabel(item.amount), p1: orderStatusLabels()[item.status]})} onClick={() => onOpen(item.orderId)}>
    <span className="cash-record-icon" aria-hidden="true"><Icon name="wallet" size={20} /></span>
    <span className="cash-record-description"><strong>{item.kind==='withdrawal'?t('copy.withdraw'):t('copy.depositCredit')}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(getLocale(), { hour12: false })}</time></span>
    <span className="cash-record-result"><strong>{item.kind==='withdrawal'?'-':'+'} {coinsLabel(item.amount)}</strong><span className={`cash-status-${item.status}`}>{item.kind==='withdrawal'?t(`withdrawal.status.${item.status}`):orderStatusLabels()[item.status]}</span></span>
    <Icon name="chevron" size={15} />
  </button>)}</div>;
}
