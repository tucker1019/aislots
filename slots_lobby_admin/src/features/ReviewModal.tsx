import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Descriptions, Input, Modal, Radio, message } from 'antd';
import type { Order } from '../services/admin';
import { reviewOrder } from '../services/admin';
import { money } from '../services/format';
import { AsyncButton } from '../components/AsyncButton';
export function ReviewModal({ order, close }: { order: Order; close: () => void }) {
 const [decision, setDecision] = useState<'approve' | 'return'>('approve'); const [reason, setReason] = useState('');
 const [requestId, setRequestId] = useState(() => crypto.randomUUID()); const client = useQueryClient();
 const review = useMutation({ mutationFn: () => reviewOrder({ kind: order.kind, orderId: order.orderId, decision, reason: reason.trim(), requestId }), onSuccess: async () => {
  await Promise.all([client.invalidateQueries({ queryKey: ['orders'] }), client.invalidateQueries({ queryKey: ['overview'] }), client.invalidateQueries({ queryKey: ['audit'] }), client.invalidateQueries({ queryKey: ['members'] }), client.invalidateQueries({ queryKey: ['member', order.uid] })]);
  void message.success('审核已记录'); close();
 } });
 const edited = () => { review.reset(); setRequestId(crypto.randomUUID()); };
 return <Modal open title={order.kind === 'deposit' ? '确认充值订单审核' : '确认提现订单审核'} onCancel={() => { if (!review.isPending) close(); }} closable={!review.isPending} mask={{ closable: false }} keyboard={!review.isPending} footer={<><AsyncButton disabled={review.isPending} onClick={close}>取消</AsyncButton><AsyncButton type="primary" danger={decision === 'return'} loading={review.isPending} disabled={reason.trim().length < 2} onClick={() => { if (!review.isPending && reason.trim().length >= 2) review.mutate(); }}>确认审核</AsyncButton></>}>
 <Alert showIcon type="warning" title="请核实原订单后提交" description={order.kind === 'deposit' ? '确认充值会按原订单入账；关闭订单将停止本次待付款流程。' : '审核通过不代表已实际打款；退回会按原订单退还本金。'} />
 <Descriptions column={1} size="small" className="modal-details" items={[{ key: 'id', label: '订单号', children: order.orderId }, { key: 'uid', label: '会员 UID', children: order.uid }, { key: 'amount', label: '原订单金额', children: money(order.amount) }, { key: 'credit', label: '入账金额', children: money(order.creditAmount) }]} />
 <Radio.Group value={decision} disabled={review.isPending} onChange={e => { setDecision(e.target.value === 'return' ? 'return' : 'approve'); edited(); }} options={[{ label: order.kind === 'deposit' ? '确认入账' : '审核通过', value: 'approve' }, { label: order.kind === 'deposit' ? '关闭订单' : '退回本金', value: 'return' }]} />
 <label className="field-label" htmlFor="review-reason">审核理由（必填，至少 2 字）</label><Input.TextArea id="review-reason" disabled={review.isPending} maxLength={500} showCount rows={3} value={reason} onChange={e => { setReason(e.target.value); edited(); }} />
 {review.error && <Alert type="error" showIcon title={review.error.message} description="重试将使用相同请求标识；修改审核内容后生成新标识。" />}
 </Modal>;
}
