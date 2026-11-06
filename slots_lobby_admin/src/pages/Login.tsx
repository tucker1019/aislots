import { Alert, Form, Input } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../services/admin';
import { useConsole } from '../features/session';
import { AsyncButton } from '../components/AsyncButton';
export function Login() {
 const setSession = useConsole(s => s.setSession); const client = useQueryClient();
 const login = useMutation({ mutationFn: auth.login, onSuccess: session => { client.clear(); setSession(session); } });
 return <div className="login"><div className="login-intro"><div className="brand">AI<span>SLOTS</span></div><div className="eyebrow">LOBBY OPERATIONS</div><h1>每一项运营决策，<br />清晰可查。</h1><p>配置发布、会员查询与资金审核的统一工作台。</p><div className="login-foot">大厅运营控制台 · 独立管理权限</div></div><div className="login-panel"><div className="eyebrow">WELCOME BACK</div><h2>登录运营后台</h2><p>使用已分配的管理员账号登录</p>{login.error && <Alert type="error" showIcon title={login.error.message} />}
 <Form layout="vertical" requiredMark={false} onFinish={(values: { username: string; password: string }) => { if (!login.isPending) login.mutate(values); }}>
 <Form.Item name="username" label="管理员账号" rules={[{ required: true, message: '请输入管理员账号' }]}><Input autoComplete="username" size="large" maxLength={100} /></Form.Item>
 <Form.Item name="password" label="登录密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password autoComplete="current-password" size="large" maxLength={200} /></Form.Item>
 <AsyncButton htmlType="submit" type="primary" size="large" block loading={login.isPending}>登录工作台</AsyncButton></Form><div className="security-note">会话通过 HttpOnly Cookie 保护</div></div></div>;
}
