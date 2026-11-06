import { useState } from 'react';
import { Input, Table, Tag } from 'antd';
import { getMembers } from '../services/admin';
import type { Member } from '../services/admin';
import { date, money } from '../services/format';
import { useCursor } from '../features/useCursor';
import { MemberDetail } from '../features/MemberDetail';
import { QueryState } from '../components/QueryState';
import { Page } from '../components/Page';
import { LoadMore } from '../components/LoadMore';
export function Members() {
 const [q, setQ] = useState(''); const [uid, setUid] = useState(''); const query = useCursor(['members', q], cursor => getMembers(q, cursor));
 return <Page eyebrow="MEMBER DIRECTORY" title="会员查询" description="只读查看会员资料、钱包余额及账变记录。" filters={<div className="filters"><Input.Search allowClear placeholder="搜索 UID、账号或昵称" aria-label="搜索会员" onSearch={setQ} /></div>}><div className="panel">
 <QueryState pending={query.isPending} error={query.isFetchNextPageError ? null : query.error} retry={() => void query.refetch()} />
 {!query.isPending && <Table<Member> rowKey="uid" dataSource={query.items} pagination={false} scroll={{ x: 1000 }} columns={[
 { title: 'UID / 账号', key: 'uid', render: (_, row) => <button className="text-link" onClick={() => setUid(row.uid)}>{row.uid}<small>{row.account}</small></button> },
 { title: '昵称', dataIndex: 'nickname' }, { title: 'VIP', dataIndex: 'vipLevel', render: value => <Tag color="gold">VIP {value}</Tag> },
 { title: '余额', dataIndex: 'coins', align: 'right', render: money }, { title: '注册时间', dataIndex: 'createdAt', render: date }, { title: '最近登录', dataIndex: 'lastLoginAt', render: date },
 ]} />}<LoadMore hasMore={Boolean(query.hasNextPage)} loading={query.isFetchingNextPage} error={query.isFetchNextPageError} onLoad={() => void query.fetchNextPage()} /></div>{uid && <MemberDetail uid={uid} close={() => setUid('')} />}</Page>;
}
