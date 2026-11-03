import { Icon } from '../../components/Icon';
import { coinsLabel } from '../account/formatCoins';
import type { RechargeOrder } from '../../services/recharge';
const orderStatusLabels = { pending: '待确认', success: '订单成功', failed: '订单失败' } as const;
export function RecordList({ items, onOpen }: { items: RechargeOrder[]; onOpen: (id: string) => void }) {
  if (!items.length) return <section className="cash-records-empty" aria-label="暂无数据">
    <span className="cash-empty-art" aria-hidden="true"><Icon name="list" size={48} /><span>◷</span></span>
    <p>暂无数据</p>
  </section>;
  return <div className="cash-records-list" aria-label="存款记录列表">{items.map(item => <button type="button" className="cash-record-row" key={item.orderId}
    aria-label={`查看存款 ${coinsLabel(item.amount)} ${orderStatusLabels[item.status]}`} onClick={() => onOpen(item.orderId)}>
    <span className="cash-record-icon" aria-hidden="true"><Icon name="wallet" size={20} /></span>
    <span className="cash-record-description"><strong>充值存款</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })}</time></span>
    <span className="cash-record-result"><strong>+ {coinsLabel(item.amount)}</strong><span className={`cash-status-${item.status}`}>{orderStatusLabels[item.status]}</span></span>
    <Icon name="chevron" size={15} />
  </button>)}</div>;
}
