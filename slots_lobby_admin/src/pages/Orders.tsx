import { useState } from 'react';
import { Input, Select, Table, Tabs, Tag } from 'antd';
import type { Order, OrderKind } from '../services/admin';
import { getOrders } from '../services/admin';
import { date, money, statusLabels } from '../services/format';
import { useCursor } from '../features/useCursor';
import { useConsole } from '../features/session';
import { ReviewModal } from '../features/ReviewModal';
import { QueryState } from '../components/QueryState';
import { Page } from '../components/Page';
import { LoadMore } from '../components/LoadMore';
import { AsyncButton } from '../components/AsyncButton';
export function Orders() {
 const [kind, setKind] = useState<OrderKind>('deposit'); const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [review, setReview] = useState<Order | null>(null);
 const role = useConsole(s => s.session?.role); const allowed = role === 'admin' || role === 'finance';
 const query = useCursor(['orders', kind, status, q], cursor => getOrders(kind, status, q, cursor));
 return <Page eyebrow="FUNDS & REVIEW" title="资金订单" description="按原订单审核充值和提现，所有人工操作均保留审计。" filters={<div className="filters stacked"><Tabs activeKey={kind} onChange={key => { setKind(key === 'withdrawal' ? 'withdrawal' : 'deposit'); setStatus(''); }} items={[{ key: 'deposit', label: '充值订单' }, { key: 'withdrawal', label: '提现订单' }]} /><div className="filter-row"><Input.Search aria-label="搜索订单" allowClear placeholder="订单号 / 会员 UID" onSearch={setQ} /><Select aria-label="订单状态" value={status} onChange={setStatus} options={[{ value: '', label: '全部状态' }, ...['pending', ...(kind === 'withdrawal' ? ['approved'] : []), 'success', 'failed'].map(value => ({ value, label: value === 'failed' ? (kind === 'deposit' ? '已关闭' : '已退回') : statusLabels[value] }))]} /><AsyncButton loading={query.isRefetching && !query.isFetchingNextPage} onClick={() => void query.refetch()}>刷新</AsyncButton></div></div>}><div className="panel">
 <QueryState pending={query.isPending} error={query.isFetchNextPageError ? null : query.error} retry={() => void query.refetch()} />
 {!query.isPending && <Table<Order> rowKey="orderId" dataSource={query.items} pagination={false} scroll={{ x: 1400 }} columns={[
 { title: '订单 / 会员', key: 'id', render: (_, r) => <><strong>{r.orderId}</strong><small>UID {r.uid}</small></> },
 { title: '状态', dataIndex: 'status', render: value => <Tag color={value.includes('pending') ? 'orange' : 'default'}>{value === 'failed' ? (kind === 'deposit' ? '已关闭' : '已退回') : (statusLabels[value] ?? value)}</Tag> },
 { title: '金额', dataIndex: 'amount', align: 'right', render: money }, { title: '手续费', dataIndex: 'fee', align: 'right', render: money }, { title: '奖励', dataIndex: 'bonus', align: 'right', render: money }, { title: '入账金额', dataIndex: 'creditAmount', align: 'right', render: money },
 { title: '渠道 / 账号', key: 'account', render: (_, r) => <>{r.channel}<small>{r.account || '—'} {r.name}</small></> },
 { title: '创建时间', dataIndex: 'createdAt', render: date }, { title: '结算时间', dataIndex: 'settledAt', render: date },
 { title: '操作', key: 'review', fixed: 'right', render: (_, row) => allowed && row.status === 'pending' ? <AsyncButton onClick={() => setReview(row)}>人工审核</AsyncButton> : '—' },
 ]} />}<LoadMore hasMore={Boolean(query.hasNextPage)} loading={query.isFetchingNextPage} error={query.isFetchNextPageError} onLoad={() => void query.fetchNextPage()} /></div>{review && <ReviewModal order={review} close={() => setReview(null)} />}</Page>;
}
