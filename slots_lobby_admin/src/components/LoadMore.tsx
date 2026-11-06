import { AsyncButton } from './AsyncButton';
export function LoadMore({ hasMore, loading, onLoad, error }: { hasMore: boolean; loading: boolean; onLoad: () => void; error?: boolean }) {
 return <div className="load-more">{hasMore ? <AsyncButton loading={loading} onClick={onLoad}>{error ? '加载失败，重试' : '加载更多'}</AsyncButton> : <span>已显示全部记录</span>}</div>;
}
