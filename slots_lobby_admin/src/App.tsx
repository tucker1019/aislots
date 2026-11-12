import { Fragment, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Tag } from 'antd';
import { auth } from './services/admin';
import { ApiError } from './services/client';
import { roleLabels } from './services/format';
import { useConsole } from './features/session';
import { AsyncButton } from './components/AsyncButton';
import { QueryState } from './components/QueryState';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Members } from './pages/Members';
import { Orders } from './pages/Orders';
import { ConfigNavigation } from './features/ConfigNavigation';
import { Configs } from './pages/Configs';
import { GamePreview } from './pages/GamePreview';
import { Audit } from './pages/Audit';
const navigation = [
 { key: 'overview', label: '运营总览', icon: '◈' }, { key: 'members', label: '会员查询', icon: '◎' },
 { key: 'orders', label: '资金订单', icon: '⇄' }, { key: 'configs', label: '大厅配置', icon: '▦' }, { key: 'audit', label: '审计日志', icon: '≡' },
 { key: 'gamePreview', label: 'Cocos 调试', icon: '▷' },
] as const;
export function App() {
 const [configsExpanded, setConfigsExpanded] = useState<boolean | null>(null);
 const session = useConsole(s => s.session); const setSession = useConsole(s => s.setSession); const screen = useConsole(s => s.screen); const navigate = useConsole(s => s.navigate); const client = useQueryClient();
 const me = useQuery({ queryKey: ['session'], queryFn: auth.me, retry: false, staleTime: Infinity, refetchOnWindowFocus: false });
 useEffect(() => { if (me.data) setSession(me.data); }, [me.data, setSession]);
 useEffect(() => {
  const expire = () => { setSession(null); client.clear(); };
  window.addEventListener('admin-session-expired', expire);
  return () => window.removeEventListener('admin-session-expired', expire);
 }, [client, setSession]);
 const showConfigs = configsExpanded ?? screen === 'configs';
 const logout = useMutation({ mutationFn: auth.logout, onSuccess: () => { setSession(null); client.clear(); navigate('overview'); } });
 if (!session) {
  if (me.isPending) return <div className="session-loading"><QueryState pending error={null} retry={() => void me.refetch()} /></div>;
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) return <div className="session-loading"><QueryState pending={false} error={me.error} retry={() => void me.refetch()} /></div>;
  return <Login />;
 }
 const content = { overview: <Overview />, members: <Members />, orders: <Orders />, configs: <Configs />, audit: <Audit />, gamePreview: <GamePreview /> };
 return <div className="console"><aside className="sidebar"><div className="brand">AI<span>SLOTS</span><small>OPERATIONS</small></div><div className="sidebar-label">大厅运营</div><nav aria-label="主导航">{navigation.map(item => <Fragment key={item.key}><button aria-current={screen === item.key && item.key !== 'configs' ? 'page' : undefined} aria-expanded={item.key === 'configs' ? showConfigs : undefined} aria-controls={item.key === 'configs' ? 'config-submenu' : undefined} className={screen === item.key ? 'active' : ''} onClick={() => {
  if (item.key === 'configs') { setConfigsExpanded(!showConfigs); if (!showConfigs) navigate('configs'); }
  else { setConfigsExpanded(null); navigate(item.key); }
 }}><span>{item.icon}</span>{item.label}{item.key === 'configs' && <span className="config-menu-caret" aria-hidden="true">{showConfigs ? '⌄' : '›'}</span>}</button>{item.key === 'configs' && showConfigs && <ConfigNavigation />}</Fragment>)}</nav><div className="sidebar-bottom"><span className="online-dot" /> LOBBY CONSOLE<small>仅管理大厅运营业务</small></div></aside><div className="workspace"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> {navigation.find(n => n.key === screen)?.label}</div><div className="user"><Tag>{roleLabels[session.role]}</Tag><Avatar size="small" style={{ background: '#264d65' }}>{session.username.slice(0, 1).toUpperCase()}</Avatar><strong>{session.username}</strong><AsyncButton size="small" loading={logout.isPending} onClick={() => logout.mutate()}>退出</AsyncButton></div></header><main>{logout.error && <Alert type="error" showIcon title={logout.error.message} />}{content[screen]}</main><footer className="console-footer">AISLOTS / 大厅运营控制台<span>操作有据 · 变更可溯</span></footer></div></div>;
}
