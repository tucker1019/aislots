import { useState } from 'react';
import { Button, Input, InputNumber, Popconfirm, Switch, Table, Tag } from 'antd';
import type { Json } from '../services/schema';
import { gameTemplate, validImagePath, validMapKey } from './configTemplates';
interface Props { value: Record<string, Json>; onChange: (value: Json) => void; disabled: boolean }
interface Entry { id: string; fields: Record<string, Json> }
export function GameCatalogEditor({ value, onChange, disabled }: Props) {
 const [id, setId] = useState('');
 const [expanded, setExpanded] = useState<readonly string[]>([]);
 const rows: Entry[] = Object.entries(value).map(([id, item]) => ({ id, fields: { ...(gameTemplate as Record<string, Json>), ...(item && typeof item === 'object' && !Array.isArray(item) ? item : {}) } })).sort((a, b) => Number(a.fields.sort) - Number(b.fields.sort) || a.id.localeCompare(b.id));
 const edit = (row: Entry, patch: Record<string, Json>) => onChange({ ...value, [row.id]: { ...row.fields, ...patch } });
 const text = (row: Entry, key: string, label: string) => <label className="document-field" key={key}>{label}<Input aria-label={`games.games.${row.id}.${key}`} value={String(row.fields[key] ?? '')} disabled={disabled} status={key === 'cover' && !!row.fields[key] && !validImagePath(String(row.fields[key])) ? 'error' : undefined} onChange={event => edit(row, { [key]: event.target.value })}/></label>;
 return <div>
  <p>排序数值越小越靠前；关闭显示后大厅不返回；显示但未上线时，点击提示“敬请期待”。修改后仍需保存并发布。</p>
  <div className="map-add"><Input aria-label="games.games 新增标识" placeholder="游戏 ID，例如 AG3" value={id} maxLength={64} disabled={disabled} onChange={event => setId(event.target.value)}/><Button disabled={disabled || !validMapKey(id, value)} onClick={() => { if (validMapKey(id, value)) { onChange({ ...value, [id]: { ...(gameTemplate as Record<string, Json>), sort: Math.max(0, ...rows.map(row => Number(row.fields.sort))) + 10 } }); setExpanded([id]); setId(''); } }}>新增条目</Button></div>
  <Table<Entry> rowKey="id" size="small" dataSource={rows} scroll={{ x: 850 }} pagination={{ pageSize: 12, showSizeChanger: false }} expandable={{ expandedRowKeys: [...expanded], onExpandedRowsChange: keys => setExpanded(keys.map(String)), expandedRowRender: row => <div className="document-object">{text(row, 'name', '名称')}{text(row, 'nameEn', '英文名称')}{text(row, 'provider', '厂商')}{text(row, 'cover', '封面（/assets/... 或 HTTPS 地址）')}{text(row, 'url', '游戏入口地址（未上线可留空）')}{text(row, 'apiUrl', '游戏 API 地址')}<Popconfirm title={`删除 ${row.id}？`} description="保存并发布后生效。" onConfirm={() => onChange(Object.fromEntries(Object.entries(value).filter(([key]) => key !== row.id)))}><Button danger disabled={disabled}>删除 {row.id}</Button></Popconfirm></div> }} columns={[
   { title: '游戏', key: 'game', render: (_, row) => <div><strong>{String(row.fields.name || row.id)}</strong><div><Tag>{row.id}</Tag><span>{String(row.fields.provider)}</span></div></div> },
   { title: '排序', key: 'sort', width: 130, render: (_, row) => <InputNumber aria-label={`games.games.${row.id}.sort`} min={0} max={2147483647} precision={0} value={Number(row.fields.sort)} disabled={disabled} onChange={sort => { if (sort !== null) edit(row, { sort }); }}/> },
   { title: '是否显示', key: 'visible', width: 110, render: (_, row) => <Switch aria-label={`games.games.${row.id}.visible`} checked={row.fields.visible === true} disabled={disabled} onChange={visible => edit(row, { visible })}/> },
   { title: '是否上线', key: 'enabled', width: 110, render: (_, row) => <Switch aria-label={`games.games.${row.id}.enabled`} checked={row.fields.enabled === true} disabled={disabled} onChange={enabled => edit(row, { enabled })}/> },
  ]}/>
 </div>;
}
