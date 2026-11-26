import { useState } from 'react';
import { Button, Input, InputNumber, Popconfirm, Select, Switch, Table, Tabs, Tag, message } from 'antd';
import type { Json } from '../services/schema';
import { syncJ7Games } from '../services/configs';
import { gameTemplate, validImagePath, validMapKey } from './configTemplates';
interface Props { value: Record<string, Json>; onChange: (value: Json) => void; disabled: boolean }
interface Entry { id: string; fields: Record<string, Json> }
type StatusFilter = 'ALL' | 'ENABLED' | 'VISIBLE_ONLY' | 'HIDDEN';
export function GameCatalogEditor({ value, onChange, disabled }: Props) {
 const [id, setId] = useState('');
 const [expanded, setExpanded] = useState<readonly string[]>([]);
 const [providerFilter, setProviderFilter] = useState<string>('ALL');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
 const [keyword, setKeyword] = useState('');
 const [syncing, setSyncing] = useState(false);
 const allRows: Entry[] = Object.entries(value).map(([id, item]) => ({ id, fields: { ...(gameTemplate as Record<string, Json>), ...(item && typeof item === 'object' && !Array.isArray(item) ? item : {}) } })).sort((a, b) => Number(a.fields.sort) - Number(b.fields.sort) || a.id.localeCompare(b.id));
 const providerCounts = new Map<string, { total: number; enabled: number }>();
 for (const row of allRows) {
  const p = String(row.fields.provider || '未分类');
  const cur = providerCounts.get(p) ?? { total: 0, enabled: 0 };
  cur.total += 1;
  if (row.fields.enabled === true && row.fields.visible === true) cur.enabled += 1;
  providerCounts.set(p, cur);
 }
 const providers = Array.from(providerCounts.keys()).sort((a, b) => (a === 'AG' ? -1 : b === 'AG' ? 1 : a.localeCompare(b)));
 const q = keyword.trim().toLowerCase();
 const rows = allRows.filter(row => {
  const p = String(row.fields.provider || '未分类');
  if (providerFilter !== 'ALL' && p !== providerFilter) return false;
  if (statusFilter === 'ENABLED' && !(row.fields.enabled === true && row.fields.visible === true)) return false;
  if (statusFilter === 'VISIBLE_ONLY' && !(row.fields.visible === true && row.fields.enabled !== true)) return false;
  if (statusFilter === 'HIDDEN' && row.fields.visible === true) return false;
  if (!q) return true;
  return row.id.toLowerCase().includes(q) || String(row.fields.name || '').toLowerCase().includes(q) || String(row.fields.nameEn || '').toLowerCase().includes(q) || String(row.fields.externalGameId || '').toLowerCase().includes(q);
 });
 const edit = (row: Entry, patch: Record<string, Json>) => onChange({ ...value, [row.id]: { ...row.fields, ...patch } });
 const batchEdit = (patch: Record<string, Json>) => {
  if (!rows.length) return;
  const next: Record<string, Json> = { ...value };
  for (const row of rows) next[row.id] = { ...row.fields, ...patch };
  onChange(next);
 };
 const text = (row: Entry, key: string, label: string) => <label className="document-field" key={key}>{label}<Input aria-label={`games.games.${row.id}.${key}`} value={String(row.fields[key] ?? '')} disabled={disabled} status={key === 'cover' && !!row.fields[key] && !validImagePath(String(row.fields[key])) ? 'error' : undefined} onChange={event => edit(row, { [key]: event.target.value })}/></label>;
 const handleSyncJ7 = async () => {
  setSyncing(true);
  try {
   const res = await syncJ7Games();
   const nextGames = res.document.games;
   if (nextGames && typeof nextGames === 'object' && !Array.isArray(nextGames)) {
    onChange(nextGames);
    message.success(`已同步三方游戏：新增 ${res.added} 款，更新 ${res.updated} 款（共 ${res.total} 款），请按需开启显示/上线后保存并发布`);
   }
  } catch (err) {
   message.error(err instanceof Error ? err.message : '同步三方游戏失败');
  } finally {
   setSyncing(false);
  }
 };
 const totalEnabled = allRows.filter(r => r.fields.enabled === true && r.fields.visible === true).length;
 const tabItems = [
  { key: 'ALL', label: `全部 (${allRows.length}${totalEnabled > 0 ? ` · 上线 ${totalEnabled}` : ''})` },
  ...providers.map(p => {
   const stat = providerCounts.get(p)!;
   return { key: p, label: `${p} (${stat.total}${stat.enabled > 0 ? ` · 上线 ${stat.enabled}` : ''})` };
  }),
 ];
 return <div>
  <p>排序数值越小越靠前；关闭显示后大厅不返回；显示但未上线时，点击提示“敬请期待”。新同步的三方游戏默认关闭显示和上线，修改后仍需保存并发布。</p>
  <Tabs size="small" activeKey={providerFilter} onChange={setProviderFilter} items={tabItems}/>
  <div className="map-add" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
   <Input aria-label="games.games 新增标识" style={{ width: 160 }} placeholder="游戏 ID，例如 AG3" value={id} maxLength={64} disabled={disabled} onChange={event => setId(event.target.value)}/>
   <Button disabled={disabled || !validMapKey(id, value)} onClick={() => { if (validMapKey(id, value)) { onChange({ ...value, [id]: { ...(gameTemplate as Record<string, Json>), provider: providerFilter === 'ALL' ? '' : providerFilter, sort: Math.max(0, ...allRows.map(row => Number(row.fields.sort))) + 10 } }); setExpanded([id]); setId(''); } }}>新增条目</Button>
   <Button type="primary" ghost loading={syncing} disabled={disabled} onClick={() => void handleSyncJ7()}>同步三方游戏 (J7)</Button>
   <Select aria-label="按状态筛选" style={{ width: 140 }} value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ALL', label: '全部状态' }, { value: 'ENABLED', label: '已显示且上线' }, { value: 'VISIBLE_ONLY', label: '仅显示(未上线)' }, { value: 'HIDDEN', label: '已隐藏' }]}/>
   <Input aria-label="搜索游戏" style={{ width: 200 }} placeholder="搜索 ID / 名称 / 三方码" value={keyword} allowClear onChange={event => setKeyword(event.target.value)}/>
   {providerFilter !== 'ALL' && <>
    <Popconfirm title={`将当前筛选的 ${rows.length} 款游戏全部设为「显示 + 上线」？`} onConfirm={() => batchEdit({ visible: true, enabled: true })}><Button size="small" disabled={disabled || !rows.length}>当前全部上线</Button></Popconfirm>
    <Popconfirm title={`将当前筛选的 ${rows.length} 款游戏全部隐藏并下线？`} onConfirm={() => batchEdit({ visible: false, enabled: false })}><Button size="small" danger disabled={disabled || !rows.length}>当前全部下线</Button></Popconfirm>
   </>}
  </div>
  <Table<Entry> rowKey="id" size="small" dataSource={rows} scroll={{ x: 850 }} pagination={{ pageSize: 12, showSizeChanger: false }} expandable={{ expandedRowKeys: [...expanded], onExpandedRowsChange: keys => setExpanded(keys.map(String)), expandedRowRender: row => <div className="document-object">{text(row, 'name', '名称')}{text(row, 'nameEn', '英文名称')}{text(row, 'provider', '厂商')}<div className="document-field"><label htmlFor={`games.games.${row.id}.source`}>接入来源</label><Select id={`games.games.${row.id}.source`} style={{width:'100%'}} aria-label={`games.games.${row.id}.source`} value={String(row.fields.source || 'local')} disabled={disabled} options={[{value:'local',label:'自研机台 (local)'},{value:'j7',label:'三方机台 (j7)'}]} onChange={source=>edit(row,{source})}/></div>{text(row, 'externalGameId', '三方游戏码（如 10049，三方必填）')}{text(row, 'cover', '封面（/assets/... 或 HTTPS 地址）')}{text(row, 'url', '游戏入口地址（未上线或三方可留空）')}{text(row, 'apiUrl', '游戏 API 地址（三方可留空）')}<div className="document-field"><label htmlFor={`games.games.${row.id}.theoreticalRtp`}>理论 RTP（%，如 97.03 显示为 97.03%）</label><InputNumber id={`games.games.${row.id}.theoreticalRtp`} style={{width:'100%'}} aria-label={`games.games.${row.id}.theoreticalRtp`} min={0} max={100} step={0.01} value={Number(row.fields.theoreticalRtp)} disabled={disabled} onChange={value=>{if(value!==null)edit(row,{theoreticalRtp:value});}}/></div>
<div className="document-field"><label htmlFor={`games.games.${row.id}.volatility`}>波动性</label><Select id={`games.games.${row.id}.volatility`} style={{width:'100%'}} aria-label={`games.games.${row.id}.volatility`} value={String(row.fields.volatility)} disabled={disabled} options={[{value:'low',label:'低'},{value:'medium_low',label:'中低'},{value:'medium',label:'中'},{value:'medium_high',label:'中高'},{value:'high',label:'高'},{value:'extreme',label:'极高'}]} onChange={volatility=>edit(row,{volatility})}/></div>
<div className="document-field"><label htmlFor={`games.games.${row.id}.maxWin`}>最高赢奖（倍，-1 为无上限）</label><InputNumber id={`games.games.${row.id}.maxWin`} style={{width:'100%'}} aria-label={`games.games.${row.id}.maxWin`} min={-1} max={Number.MAX_SAFE_INTEGER} precision={0} status={Number(row.fields.maxWin)===0?'error':undefined} value={Number(row.fields.maxWin)} disabled={disabled} onChange={value=>{if(value!==null)edit(row,{maxWin:value});}}/>{Number(row.fields.maxWin)===0&&<span role="alert">请输入正整数，或 -1 表示无上限</span>}</div><Popconfirm title={`删除 ${row.id}？`} description="保存并发布后生效。" onConfirm={() => onChange(Object.fromEntries(Object.entries(value).filter(([key]) => key !== row.id)))}><Button danger disabled={disabled}>删除 {row.id}</Button></Popconfirm></div> }} columns={[
   { title: '游戏', key: 'game', render: (_, row) => <div><strong>{String(row.fields.name || row.id)}</strong><div><Tag>{row.id}</Tag>{row.fields.source === 'j7' && <Tag color="blue">J7</Tag>}<span>{String(row.fields.provider)}</span></div></div> },
   { title: '排序', key: 'sort', width: 130, render: (_, row) => <InputNumber aria-label={`games.games.${row.id}.sort`} min={0} max={2147483647} precision={0} value={Number(row.fields.sort)} disabled={disabled} onChange={sort => { if (sort !== null) edit(row, { sort }); }}/> },
   { title: '是否显示', key: 'visible', width: 110, render: (_, row) => <Switch aria-label={`games.games.${row.id}.visible`} checked={row.fields.visible === true} disabled={disabled} onChange={visible => edit(row, { visible })}/> },
   { title: '是否上线', key: 'enabled', width: 110, render: (_, row) => <Switch aria-label={`games.games.${row.id}.enabled`} checked={row.fields.enabled === true} disabled={disabled} onChange={enabled => edit(row, { enabled })}/> },
  ]}/>
 </div>;
}
