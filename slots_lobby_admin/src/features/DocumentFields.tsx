import { ExperienceGameWeights } from './ExperienceGameWeights';
import { GameCatalogEditor } from './GameCatalogEditor';
import { useState } from 'react';
import { Button, Collapse, Input, InputNumber, Select, Switch } from 'antd';
import { gameTemplate, arrayTemplate, internalRoutes, mapTemplate, validImagePath, validMapKey } from './configTemplates';
import type { Json } from '../services/schema';
const labels: Record<string, string> = { amount: '金额（分）', bonus: '奖励（分）', fee: '手续费（分）', enabled: '启用', gameWeights: '游戏分配权重', stopEveryRounds: '每多少局判断停止（局）', stopChancePercent: '停止概率（%，0 表示不随机停止）', visible: '是否显示', sort: '排序（数值越小越靠前）', cover: '游戏封面', name: '名称', nameEn: '英文名称', provider: '厂商', url: '游戏入口地址', apiUrl: '游戏 API 地址', version: '业务版本', days: '签到天数', timezone: '时区', levels: 'VIP 等级', tiers: '档位', games: '游戏列表', providers: '提供商', multipliers: '流水倍数', durationDays: '持续天数', rewardAmount: '奖励金额（分）', minDepositAmount: '最低充值（分）', minBetAmount: '最低投注（分）', minDepositCount: '最低充值次数', baseUrl: '基础链接', supportUrl: '客服链接', displayRows: '展示行数', idleDays: '闲置天数', protectionDays: '保护天数', country: '国家', currency: '币种', dailyRateBps: '日返水（基点）', weeklyRateBps: '周返水（基点）', monthlyRateBps: '月返水（基点）', loserReturnRateBps: '亏损返还（基点）', expireUnclaimed: '到期取消未领取', createMinSeconds: '创建最短秒数', createMaxSeconds: '创建最长秒数', playMinSeconds: '游玩最短秒数', playMaxSeconds: '游玩最长秒数' };
function blank(value: Json): Json {
 if (Array.isArray(value)) return [];
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blank(item)]));
 if (typeof value === 'number') return 0;
 if (typeof value === 'boolean') return false;
 if (typeof value === 'string') return '';
 return null;
}
function KeyedMap({ value, onChange, disabled, path }: { value: Record<string, Json>; onChange: (value: Json) => void; disabled: boolean; path: string }) {
 const [key, setKey] = useState('');
 const valid = validMapKey(key, value);
 const template = mapTemplate(path);
 return <div><div className="map-add"><Input aria-label={`${path} 新增标识`} placeholder="字母开头，字母 / 数字 / _ / -" value={key} maxLength={64} disabled={disabled} onChange={e => setKey(e.target.value)} /><Button disabled={disabled || !valid} onClick={() => { if (template !== undefined && valid) { onChange({ ...value, [key]: structuredClone(template) }); setKey(''); } }}>新增条目</Button></div>{key && !valid && <p role="alert" className="map-error">标识格式不正确、已存在或属于保留名称。</p>}{Object.entries(value).map(([name, item]) => <div className="document-field nested" key={name}><label>{name}</label><DocumentFields value={path === 'games.games' && item && typeof item === 'object' && !Array.isArray(item) ? { ...(gameTemplate as Record<string, Json>), ...item } : item} disabled={disabled} path={`${path}.${name}`} onChange={next => onChange({ ...value, [name]: next })} /><Button danger size="small" disabled={disabled} onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([entry]) => entry !== name)))}>删除 {name}</Button></div>)}</div>;
}
export function DocumentFields({ value, onChange, disabled = false, path = '配置' }: { value: Json; onChange: (value: Json) => void; disabled?: boolean; path?: string }) {
 if (Array.isArray(value)) {
  const template = arrayTemplate(path) ?? (value.length ? blank(value[0]) : undefined);
  return <div className="document-array"><div className="array-heading"><span>{value.length} 个项目</span><Button size="small" disabled={disabled || template === undefined} onClick={() => { if (template !== undefined) onChange([...value, structuredClone(template)]); }}>添加项目</Button></div>{value.length === 0 && <p className="muted">当前列表为空，可使用预设字段添加项目。</p>}<Collapse items={value.map((item, index) => ({ key: String(index), label: `项目 ${index + 1}`, children: <><DocumentFields value={item} path={`${path}[${index}]`} disabled={disabled} onChange={next => onChange(value.map((previous, i) => i === index ? next : previous))} /><Button danger size="small" disabled={disabled} onClick={() => onChange(value.filter((_, i) => i !== index))}>移除此项目</Button></> }))} /></div>;
 }
 if (value !== null && typeof value === 'object') {
  if (path === 'experience.gameWeights') return <ExperienceGameWeights value={value} disabled={disabled} onChange={onChange}/>;
  if (path === 'games.games') return <GameCatalogEditor value={value} disabled={disabled} onChange={onChange}/>;
  if (mapTemplate(path) !== undefined) return <KeyedMap value={value} disabled={disabled} path={path} onChange={onChange} />;
  const fields = path === 'experience' ? {gameWeights:{AG1:1},stopEveryRounds:50,stopChancePercent:20,...value} : value;
  return <div className="document-object">{Object.entries(fields).map(([key, item]) => <div className={`document-field ${item !== null && typeof item === 'object' ? 'nested' : ''}`} key={key}><label>{key === 'enabled' && /^games\.games\./.test(path) ? '是否上线' : (labels[key] ?? key)}<code>{key}</code></label><DocumentFields value={item} disabled={disabled} path={`${path}.${key}`} onChange={next => onChange({ ...fields, [key]: next })} /></div>)}</div>;
 }
 if (typeof value === 'boolean') return <Switch aria-label={path} checked={value} disabled={disabled} onChange={onChange} />;
 if (typeof value === 'number') return <InputNumber aria-label={path} value={value} disabled={disabled} style={{ width: '100%' }} onChange={next => { if (typeof next === 'number' && Number.isSafeInteger(next)) onChange(next); }} />;
 if (typeof value === 'string') {
  if (/^content\.banners\[\d+\]\.route$/.test(path)) return <Select aria-label={path} value={value} disabled={disabled} style={{ width: '100%' }} options={internalRoutes.map(route => ({ label: route, value: route }))} onChange={onChange} />;
  if (/^content\.banners\[\d+\]\.image(ZhTw|EnUs)$/.test(path) || /^games\.games\.[^.]+\.cover$/.test(path)) return <><Input aria-label={path} value={value} disabled={disabled} status={value && !validImagePath(value) ? 'error' : undefined} placeholder="/assets/... 或 https://..." onChange={event => onChange(event.target.value)} />{value && !validImagePath(value) && <p className="map-error" role="alert">仅支持 /assets/ 站内路径或 HTTPS 图片地址。</p>}</>;
  return <Input aria-label={path} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} />;
 }
 return <span className="muted">未设置（null）</span>;
}
