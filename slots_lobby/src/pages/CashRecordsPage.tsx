import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { useAccountProfile } from '../features/account/useAccountProfile';
import { RecordFilters } from '../features/cash-records/RecordFilters';
import type { RecordKind } from '../features/cash-records/RecordFilters';
import { RecordList } from '../features/cash-records/RecordList';
import { RecordDetail } from '../features/cash-records/RecordDetail';
import { recordRange } from '../features/cash-records/range';
import type { RecordPeriod } from '../features/cash-records/range';
import { fetchCashRecords } from '../services/cash-records';
import { navigateLobby } from '../app/useLobbyRoute';
import { isRecord } from '../features/account/types';

export function CashRecordsPage({ onBack, onComingSoon, orderId }: { onBack: () => void; onComingSoon: () => void; orderId?: string }) {
  const [kind, setKind] = useState<RecordKind>('all');
  const [period, setPeriod] = useState<RecordPeriod>('today');
  const profile = useAccountProfile();
  const client = useQueryClient();
  useEffect(() => () => { void client.invalidateQueries({ queryKey: ['lobby', 'current-profile'] }); }, [client]);
  const now = new Date(); const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const range = useMemo(() => recordRange(period, new Date(midnight)), [period, midnight]);
  const query = useInfiniteQuery({ queryKey: ['cash-records', profile.data?.uid, range.from, range.to],
    enabled: !!profile.data, initialPageParam: '', queryFn: ({ pageParam, signal }) => fetchCashRecords(range, pageParam, signal),
    getNextPageParam: page => page.nextCursor || undefined, retry: false,
    refetchInterval: result => result.state.data?.pages.some(page => page.items.some(item => item.status === 'pending')) ? 3000 : false });
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  const scroll = useRef(0); const previousOrder = useRef(orderId);
  useEffect(() => {
    if (previousOrder.current && !orderId) {
      const frame = requestAnimationFrame(() => document.getElementById('root')?.scrollTo({ top: scroll.current }));
      previousOrder.current = orderId;
      return () => cancelAnimationFrame(frame);
    }
    previousOrder.current = orderId;
  }, [orderId]);
  function open(id: string) { scroll.current = document.getElementById('root')?.scrollTop ?? 0; navigateLobby('records', { orderId: id }); }
  function closeDetail() {
    const state: unknown = window.history.state;
    if (isRecord(state) && state.lobbyFrom === '/records') window.history.back();
    else navigateLobby('records');
  }
  if (orderId) return <RecordDetail key={orderId} orderId={orderId} onBack={closeDetail} />;
  const failed = profile.isError || (query.isError && items.length === 0);
  const loading = profile.isPending || (!profile.isError && query.isPending);
  function retry() { if (profile.isError) void profile.refetch(); else void query.refetch(); }
  return <RecordsLayout title="存取记录" backLabel="返回我的" onBack={onBack} filters={<RecordFilters kind={kind} period={period} onKind={setKind} onPeriod={value => { setPeriod(value); document.getElementById('root')?.scrollTo({ top: 0 }); }} onComingSoon={onComingSoon} />}>
    {loading ? <p className="cash-records-feedback" role="status">正在加载记录…</p>
      : failed ? <section className="cash-records-feedback" role="alert"><p>记录暂时无法加载</p><button type="button" disabled={profile.isFetching || query.isFetching} onClick={retry}>重新加载</button></section>
      : <><RecordList items={items} onOpen={open} />
        {query.isRefetchError && <p className="cash-records-feedback" role="alert">刷新失败，<button type="button" disabled={query.isFetching} onClick={retry}>重试</button></p>}
        {query.isFetchNextPageError && <p className="cash-records-feedback" role="alert">加载更多失败，请重试</p>}
        {query.hasNextPage ? <button type="button" className="cash-load-more" disabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }}>{query.isFetchingNextPage ? '正在加载…' : query.isFetchNextPageError ? '重试加载更多' : '加载更多'}</button>
          : items.length > 0 && <p className="cash-records-end">已全部加载～</p>}
      </>}
  </RecordsLayout>;
}
