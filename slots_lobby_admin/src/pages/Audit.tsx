import { useState } from 'react';
import { Input, Table, Tag } from 'antd';
import { getAudit } from '../services/admin';
import { date } from '../services/format';
import { useCursor } from '../features/useCursor';
import { QueryState } from '../components/QueryState';
import { Page } from '../components/Page';
import { LoadMore } from '../components/LoadMore';
export function Audit() {
 const [q, setQ] = useState(''); const query = useCursor(['audit', q], cursor => getAudit(q, cursor));
 return <Page eyebrow="ACCOUNTABILITY" title="审计日志" description="追溯配置版本与人工审核的操作者、目标和理由。" filters={<div className="filters"><Input.Search allowClear aria-label="搜索审计" placeholder="搜索操作人、目标或操作" onSearch={setQ} /></div>}><div className="panel"><QueryState pending={query.isPending} error={query.isFetchNextPageError ? null : query.error} retry={() => void query.refetch()} />
 {!query.isPending && <Table rowKey="id" dataSource={query.items} pagination={false} scroll={{ x: 900 }} columns={[{ title: '操作人', dataIndex: 'username' }, { title: '操作', dataIndex: 'action', render: v => <Tag>{v}</Tag> }, { title: '目标', dataIndex: 'target' }, { title: '理由', dataIndex: 'reason' }, { title: '时间', dataIndex: 'createdAt', render: date }]} />}<LoadMore hasMore={Boolean(query.hasNextPage)} loading={query.isFetchingNextPage} error={query.isFetchNextPageError} onLoad={() => void query.fetchNextPage()} /></div></Page>;
}
