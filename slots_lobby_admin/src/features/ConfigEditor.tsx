import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Input, Modal, Table, Tabs, Tag } from 'antd';
import type { Config } from '../services/configs';
import { publishConfig, rollbackConfig, saveDraft, validateConfig } from '../services/configs';
import type { Json } from '../services/schema';
import { date } from '../services/format';
import { useConsole } from './session';
import { DocumentFields } from './DocumentFields';
import { AsyncButton } from '../components/AsyncButton';
type Action = { kind: 'publish' } | { kind: 'rollback'; version: number };
export function ConfigEditor({ config }: { config: Config }) {
 const role = useConsole(s => s.session?.role); const canEdit = role === 'admin' || role === 'operator'; const canPublish = role === 'admin';
 const [document, setDocument] = useState<Json>(config.draft ?? config.published); const [reason, setReason] = useState(''); const [action, setAction] = useState<Action | null>(null);
 const [requestId, setRequestId] = useState(() => crypto.randomUUID()); const [validated, setValidated] = useState(false);
 const [base, setBase] = useState(config); const [validationError, setValidationError] = useState('');
 const { message } = App.useApp(); const client = useQueryClient();
 const dirty = JSON.stringify(document) !== JSON.stringify(base.draft ?? base.published);
 const validate = useMutation({ mutationFn: () => validateConfig(config.key, document), onSuccess: () => { setValidated(true); setValidationError(''); void message.success('配置校验通过'); }, onError: e => { setValidated(false); setValidationError(e.message); } });
 const save = useMutation({ mutationFn: () => saveDraft(config.key, document, Math.max(base.publishedVersion, base.draftVersion), reason.trim()), onSuccess: next => {
  setBase(next); setDocument(next.draft ?? next.published); setReason(''); setValidated(false); void client.invalidateQueries({ queryKey: ['configs'] }); void message.success('草稿已保存');
 } });
 const commit = useMutation({ mutationFn: () => {
  if (!action) throw new Error('请选择配置操作');
  return action.kind === 'publish' ? publishConfig(config.key, base.draftVersion, reason.trim(), requestId) : rollbackConfig(config.key, action.version, base.publishedVersion, reason.trim(), requestId);
 }, onSuccess: next => { setBase(next); setDocument(next.draft ?? next.published); setAction(null); setReason(''); setValidated(false); void message.success('配置版本已发布'); void client.invalidateQueries({ queryKey: ['configs'] }); void client.invalidateQueries({ queryKey: ['audit'] }); } });
 const busy = validate.isPending || save.isPending || commit.isPending;
 const edit = (next: Json) => { setDocument(next); setValidated(false); setValidationError(''); save.reset(); };
 return <><div className="config-heading"><div><h2>{base.label}</h2><Tag>已发布 v{base.publishedVersion}</Tag><Tag color="blue">草稿 v{base.draftVersion}</Tag>{dirty && <Tag color="orange">有未保存修改</Tag>}</div></div>
 <Alert showIcon type="info" title="配置以完整文档校验后发布" description="保存草稿不会改变线上大厅。发布及回滚仅限管理员；服务端校验失败时维持原版本。修改金额请注意单位：分。" />
 <Tabs items={[{ key: 'edit', label: '结构化编辑', children: <><DocumentFields path={config.key} value={document} onChange={edit} disabled={!canEdit || busy} /><div className="config-actions"><label className="field-label" htmlFor="config-reason">变更理由</label><Input.TextArea id="config-reason" value={reason} maxLength={500} rows={2} disabled={busy || !canEdit} placeholder="说明本次配置调整的目的（至少 2 字）" onChange={e => { setReason(e.target.value); commit.reset(); }} /><div className="action-row"><AsyncButton loading={validate.isPending} disabled={busy} onClick={() => validate.mutate()}>校验配置</AsyncButton>{canEdit && <AsyncButton loading={save.isPending} disabled={busy || !dirty || reason.trim().length < 2} onClick={() => save.mutate()}>保存草稿</AsyncButton>}{canPublish && <AsyncButton type="primary" disabled={busy || dirty || base.draft === null || !validated || reason.trim().length < 2} onClick={() => { setRequestId(crypto.randomUUID()); commit.reset(); setAction({ kind: 'publish' }); }}>发布草稿</AsyncButton>}{validated && <Tag color="green">校验通过</Tag>}</div>{validationError && <Alert showIcon type="error" title={validationError} />}{save.error && <Alert showIcon type="error" title={save.error.message} description="版本冲突时请重新选择此配置加载最新版本。" />}</div></> },
 { key: 'history', label: '版本历史', children: <Table rowKey={(r) => `${r.version}-${r.status}`} size="small" scroll={{ x: 700 }} pagination={false} dataSource={base.history} columns={[{ title: '版本', dataIndex: 'version', render: v => `v${v}` }, { title: '状态', dataIndex: 'status' }, { title: '操作人', dataIndex: 'username' }, { title: '时间', dataIndex: 'createdAt', render: date }, { title: '理由', dataIndex: 'reason' }, { title: '操作', key: 'rollback', render: (_, row) => canPublish && row.version !== base.publishedVersion && row.status !== 'draft' ? <AsyncButton onClick={() => { setReason(''); setRequestId(crypto.randomUUID()); commit.reset(); setAction({ kind: 'rollback', version: row.version }); }}>回滚至此版本</AsyncButton> : '—' }]} /> },
 { key: 'preview', label: '已发布快照', children: <pre className="json-preview">{JSON.stringify(base.published, null, 2)}</pre> }]} />
 <Modal open={action !== null} title={action?.kind === 'rollback' ? `确认回滚至 v${action.version}` : '确认发布配置'} closable={!commit.isPending} mask={{ closable: false }} keyboard={!commit.isPending} onCancel={() => { if (!commit.isPending) setAction(null); }} footer={<><AsyncButton disabled={commit.isPending} onClick={() => setAction(null)}>取消</AsyncButton><AsyncButton type="primary" loading={commit.isPending} disabled={reason.trim().length < 2} onClick={() => { if (!commit.isPending) commit.mutate(); }}>确认{action?.kind === 'rollback' ? '回滚' : '发布'}</AsyncButton></>}>
 <Alert type="warning" showIcon title="此操作将改变大厅线上配置" description="回滚会生成新的发布版本，既有资金订单保持原订单金额。" /><label htmlFor="publish-reason" className="field-label">发布理由（至少 2 字）</label><Input.TextArea id="publish-reason" rows={3} value={reason} disabled={commit.isPending} maxLength={500} onChange={e => { setReason(e.target.value); setRequestId(crypto.randomUUID()); commit.reset(); }} />{commit.error && <Alert showIcon type="error" title={commit.error.message} />}</Modal></>;
}
