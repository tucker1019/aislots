import { RecordsLayout } from '../components/records/RecordsLayout';
import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { loadBetRecords } from '../services/bet-records';
import { useSessionStore } from '../stores/session';
import { recordRange, periodLabels } from '../features/cash-records/range';
import type { RecordPeriod } from '../features/cash-records/range';
import { BetRecordList } from '../features/bet-records/BetRecordList';
import { betMoney } from '../features/bet-records/money';

export function BetRecordsPage({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<RecordPeriod>('today');
  const [panel, setPanel] = useState<'provider' | 'period' | null>(null);
  const [provider, setProvider] = useState('');
  const range = useMemo(() => recordRange(period), [period]);
  const uid = useSessionStore(state => state.session?.uid);
  const query = useInfiniteQuery({ queryKey: ['lobby', 'bet-records', uid, range.from, range.to, provider], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => loadBetRecords(range.from, range.to, pageParam, signal, provider),
    getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined, retry: false, staleTime: 0 });
  const summary = query.data?.pages[0];
  const items = Array.from(new Map(query.data?.pages.flatMap(page => page.items).map(row => [row.gameId + ':' + row.betId, row]) ?? []).values());
  const changePeriod = (next: RecordPeriod) => { setPeriod(next); setPanel(null); };
  return <RecordsLayout title="投注记录" backLabel="返回我的" onBack={onBack} filters={
    <div className="cash-filter-container" onKeyDown={event => { if (event.key === 'Escape') setPanel(null); }}>
      <div className="cash-filter-bar">
        <button type="button" aria-expanded={panel === 'provider'} onClick={() => setPanel(panel === 'provider' ? null : 'provider')}>{provider || '全部'}<span aria-hidden="true">{panel === 'provider' ? '▴' : '▾'}</span></button>
        <button type="button" aria-expanded={panel === 'period'} onClick={() => setPanel(panel === 'period' ? null : 'period')}>{periodLabels[period]}<span aria-hidden="true">{panel === 'period' ? '▴' : '▾'}</span></button>
      </div>
      {panel && <>
        <button className="cash-filter-backdrop" type="button" aria-label="收起筛选" onClick={() => setPanel(null)} />
        <div className="cash-filter-options" aria-label={panel === 'provider' ? '游戏厂商' : '记录时间'}>
          {panel === 'provider' ? ['', ...(summary?.providers ?? [])].map(value => <button type="button" key={value} aria-pressed={provider === value} onClick={() => { setProvider(value); setPanel(null); }}>{value || '全部'}</button>) : (['today', 'yesterday', 'week'] as const).map(value => <button type="button" key={value} aria-pressed={period === value} onClick={() => changePeriod(value)}>{periodLabels[value]}</button>)}
        </div>
      </>}
    </div>}>
    {summary && <div className="bet-records-summary"><div><span>笔数</span><strong>{summary.count}</strong></div><div><span>投注总额（{summary.currency}）</span><strong>{betMoney(summary.betAmount)}</strong></div><div><span>净输赢（{summary.currency}）</span><strong className={summary.profit < 0 ? 'bet-loss' : 'bet-gain'}>{betMoney(summary.profit)}</strong></div></div>}
    {query.isPending ? <div className="bet-records-feedback" role="status">正在加载投注记录…</div> : !summary ? <div className="bet-records-feedback" role="alert"><p>投注记录加载失败</p><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>重试</button></div> : <>
      {items.length ? <BetRecordList items={items} /> : <div className="bet-records-feedback"><Icon name="list" size={42} /><p>暂无投注记录</p></div>}
      {query.isError && <p role="alert" className="bet-records-feedback">加载失败，已保留当前记录，请重试</p>}
      {query.hasNextPage && <button className="bet-records-more" type="button" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? '加载中…' : query.isError ? '重试加载' : '加载更多'}</button>}
    </>}
    <p className="bet-records-note">免费游戏与消除派彩合并到原投注中，金额以已结算部分为准。</p>
  </RecordsLayout>;
}
