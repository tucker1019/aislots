import { useQuery } from '@tanstack/react-query';
import { Descriptions, Drawer, Table, Typography } from 'antd';
import { getMember } from '../services/admin';
import { date, money } from '../services/format';
import { QueryState } from '../components/QueryState';
export function MemberDetail({ uid, close }: { uid: string; close: () => void }) {
 const query = useQuery({ queryKey: ['member', uid], queryFn: () => getMember(uid) });
 const d = query.data;
 return <Drawer title="会员详情" open onClose={close} size="large"><QueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />{d && <>
 <Descriptions column={2} bordered size="small" items={[
 { key: 'uid', label: 'UID', children: d.member.uid }, { key: 'account', label: '账号', children: d.member.account },
 { key: 'nickname', label: '昵称', children: d.member.nickname }, { key: 'vip', label: 'VIP', children: d.member.vipLevel },
 { key: 'coins', label: '钱包余额', children: money(d.wallet.coins) }, { key: 'turnover', label: '待完成流水', children: money(d.wallet.turnoverRequired) },
 { key: 'created', label: '注册时间', children: date(d.member.createdAt) }, { key: 'login', label: '最近登录', children: date(d.member.lastLoginAt) },
 ]} /><Typography.Title level={5}>收款账号 · 已脱敏</Typography.Title><Table rowKey={(r) => `${r.channel}-${r.account}`} size="small" pagination={false} dataSource={d.accounts} columns={[{ title: '渠道', dataIndex: 'channel' }, { title: '账号', dataIndex: 'account' }, { title: '姓名', dataIndex: 'name' }]} />
 <Typography.Title level={5}>近期账变</Typography.Title><Table rowKey="id" scroll={{ x: 600 }} size="small" pagination={false} dataSource={d.ledger} columns={[{ title: '类型', dataIndex: 'type' }, { title: '金额', dataIndex: 'amount', render: money }, { title: '余额', dataIndex: 'balance', render: money }, { title: '时间', dataIndex: 'createdAt', render: date }]} /></>}</Drawer>;
}
