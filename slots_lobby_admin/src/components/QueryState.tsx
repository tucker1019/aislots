import { Alert, Empty, Spin } from 'antd';
import { AsyncButton } from './AsyncButton';
export function QueryState({ pending, error, retry, empty = false }: { pending: boolean; error: Error | null; retry: () => void; empty?: boolean }) {
 if (pending) return <div className="state"><Spin tip="加载数据" fullscreen={false}><div className="spin-space" /></Spin></div>;
 if (error) return <Alert type="error" showIcon title="数据加载失败" description={error.message} action={<AsyncButton onClick={retry}>重试</AsyncButton>} />;
 if (empty) return <Empty description="暂无记录" />;
 return null;
}
