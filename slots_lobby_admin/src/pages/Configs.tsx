import { useQuery } from '@tanstack/react-query';
import { getConfig } from '../services/configs';
import { useConfigSelection } from '../features/useConfigSelection';
import { Page } from '../components/Page';
import { QueryState } from '../components/QueryState';
import { ConfigEditor } from '../features/ConfigEditor';
import { AsyncButton } from '../components/AsyncButton';
function SelectedConfig({ selected }: { selected: string }) {
 const query = useQuery({ queryKey: ['config', selected], queryFn: () => getConfig(selected), staleTime: 0 });
 return <div className="config-content"><div className="config-refresh"><AsyncButton size="small" loading={query.isRefetching} onClick={() => void query.refetch()}>重新加载配置</AsyncButton></div><QueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />{query.data && <ConfigEditor key={`${selected}-${query.dataUpdatedAt}`} config={query.data} />}</div>;
}
export function Configs() {
 const { query, selected } = useConfigSelection();
 return <Page eyebrow="LOBBY CONFIGURATION" title="大厅配置" description="从左侧子菜单选择配置，草稿校验通过后按版本发布。"><QueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} empty={query.data?.length === 0} />{selected && <div className="panel"><SelectedConfig key={selected.key} selected={selected.key} /></div>}</Page>;
}
