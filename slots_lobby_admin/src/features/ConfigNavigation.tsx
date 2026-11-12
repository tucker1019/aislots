import { useConfigSelection } from './useConfigSelection';
import { useConsole } from './session';
import { AsyncButton } from '../components/AsyncButton';

export function ConfigNavigation() {
 const { query, selected } = useConfigSelection();
 const active = useConsole(s => s.screen === 'configs');
 const selectConfig = useConsole(s => s.selectConfig);
 return <div id="config-submenu" className="config-submenu" aria-label="大厅配置子菜单">
  {query.isPending && <div className="config-menu-state" role="status">加载配置分类…</div>}
  {query.error && <div className="config-menu-state" role="alert">分类加载失败<AsyncButton size="small" loading={query.isFetching} onClick={() => void query.refetch()}>重试</AsyncButton></div>}
  {query.data?.length === 0 && <div className="config-menu-state">暂无配置分类</div>}
  {query.data?.map(config => <button key={config.key} className={active && selected?.key === config.key ? 'active' : ''} aria-current={active && selected?.key === config.key ? 'page' : undefined} title={config.description} onClick={() => selectConfig(config.key)}>{config.label}{config.hasDraft && <i className="config-draft-dot" aria-label="有草稿" />}</button>)}
 </div>;
}
