import { Button, Empty, Result, Skeleton } from 'antd';
export function GamesLoading() {
  return <div className="game-grid loading-grid" role="status" aria-label="正在加载游戏">
    {Array.from({ length: 4 }, (_, index) => <div className="loading-card" key={index}>
      <Skeleton.Node active style={{ width: '100%', height: 194 }} /><Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1 }} />
    </div>)}
  </div>;
}
export function GamesError({ retry, loading }: { retry: () => void; loading: boolean }) {
  return <div className="catalog-state" role="alert"><Result status="warning" title="游戏暂时没有加载成功"
    subTitle="请检查网络连接，再试一次。" extra={<Button type="primary" onClick={retry} loading={loading} disabled={loading}>重新加载</Button>} /></div>;
}
export function GamesEmpty({ title, description, reset, action = '发现游戏', loading = false }: {
  title: string; description: string; reset: () => void; action?: string; loading?: boolean;
}) {
  return <div className="catalog-state"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><strong>{title}</strong><p>{description}</p></>}>
    <Button onClick={reset} type="primary" loading={loading} disabled={loading}>{action}</Button>
  </Empty></div>;
}
