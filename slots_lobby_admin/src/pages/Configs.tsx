import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tag } from 'antd';
import { getConfig, getConfigs } from '../services/configs';
import { Page } from '../components/Page';
import { QueryState } from '../components/QueryState';
import { ConfigEditor } from '../features/ConfigEditor';
import { AsyncButton } from '../components/AsyncButton';
function SelectedConfig({ selected }: { selected: string }) {
 const query = useQuery({ queryKey: ['config', selected], queryFn: () => getConfig(selected), staleTime: 0 });
 return <div className="config-content"><div className="config-refresh"><AsyncButton size="small" loading={query.isRefetching} onClick={() => void query.refetch()}>重新加载配置</AsyncButton></div><QueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />{query.data && <ConfigEditor key={`${selected}-${query.dataUpdatedAt}`} config={query.data} />}</div>;
}
export function Configs() {
 const [selection, setSelection] = useState(''); const query = useQuery({ queryKey: ['configs'], queryFn: getConfigs });
 const selected = selection || query.data?.[0]?.key || '';
 return <Page eyebrow="LOBBY CONFIGURATION" title="大厅配置" description="结构化编辑运营配置，草稿校验通过后按版本发布。"><QueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} empty={query.data?.length === 0} />{query.data && query.data.length > 0 && <div className="config-layout panel"><nav className="config-nav" aria-label="配置分区">{query.data.map(config => <button className={selected === config.key ? 'active' : ''} key={config.key} onClick={() => setSelection(config.key)}><strong>{config.label}</strong><span>{config.description || config.key}</span><Tag color={config.hasDraft ? 'blue' : 'default'}>{config.hasDraft ? '有草稿' : `v${config.publishedVersion}`}</Tag></button>)}</nav>{selected && <SelectedConfig key={selected} selected={selected} />}</div>}</Page>;
}
