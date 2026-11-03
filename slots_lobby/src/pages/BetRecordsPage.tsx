import {NetworkError} from '../components/feedback/NetworkError';
import { t } from '../i18n';
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
  return <RecordsLayout title={t('copy.betHistory')} backLabel={t('copy.backToMyAccount')} onBack={onBack} filters={
    <div className="cash-filter-container" onKeyDown={event => { if (event.key === 'Escape') setPanel(null); }}>
      <div className="cash-filter-bar">
        <button type="button" aria-expanded={panel === 'provider'} onClick={() => setPanel(panel === 'provider' ? null : 'provider')}>{provider || t('copy.all')}<span aria-hidden="true">{panel === 'provider' ? '▴' : '▾'}</span></button>
        <button type="button" aria-expanded={panel === 'period'} onClick={() => setPanel(panel === 'period' ? null : 'period')}>{periodLabels()[period]}<span aria-hidden="true">{panel === 'period' ? '▴' : '▾'}</span></button>
      </div>
      {panel && <>
        <button className="cash-filter-backdrop" type="button" aria-label={t('copy.closeFilters')} onClick={() => setPanel(null)} />
        <div className="cash-filter-options" aria-label={panel === 'provider' ? t('copy.gameProviders') : t('copy.recordDate')}>
          {panel === 'provider' ? ['', ...(summary?.providers ?? [])].map(value => <button type="button" key={value} aria-pressed={provider === value} onClick={() => { setProvider(value); setPanel(null); }}>{value || t('copy.all')}</button>) : (['today', 'yesterday', 'week'] as const).map(value => <button type="button" key={value} aria-pressed={period === value} onClick={() => changePeriod(value)}>{periodLabels()[value]}</button>)}
        </div>
      </>}
    </div>}>
    {summary && <div className="bet-records-summary"><div><span>{t('copy.bets')}</span><strong>{summary.count}</strong></div><div><span>{t('copy.totalBets')}{summary.currency}{t('common.closeParenthesis')}</span><strong>{betMoney(summary.betAmount)}</strong></div><div><span>{t('copy.netProfit254')}{summary.currency}{t('common.closeParenthesis')}</span><strong className={summary.profit < 0 ? 'bet-loss' : 'bet-gain'}>{betMoney(summary.profit)}</strong></div></div>}
    {query.isPending ? <div className="bet-records-feedback" role="status">{t('copy.loadingBetHistory')}</div> : !summary ? <NetworkError disabled={query.isFetching} onRetry={() => void query.refetch()}/> : <>
      {items.length ? <BetRecordList items={items} /> : <div className="bet-records-feedback"><Icon name="list" size={42} /><p>{t('copy.noBetsFound')}</p></div>}
      {query.isError && <p role="alert" className="bet-records-feedback">{t('copy.loadingFailedExistingRecordsArePreservedPlease')}</p>}
      {query.hasNextPage && <button className="bet-records-more" type="button" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? t('copy.loading') : query.isError ? t('copy.retryLoading') : t('copy.loadMore')}</button>}
    </>}
    <p className="bet-records-note">{t('copy.freeGamesAndCascadePayoutsBelongTo')}</p>
  </RecordsLayout>;
}
