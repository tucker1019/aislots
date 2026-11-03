import { t } from '../../i18n';
import { useState } from 'react';
import { periodLabels } from './range';
import type { RecordPeriod } from './range';
export type RecordKind = 'all' | 'deposit' | 'withdrawal';
export function RecordFilters({ kind, period, onKind, onPeriod }: {
  kind: RecordKind; period: RecordPeriod; onKind: (kind: RecordKind) => void;
  onPeriod: (period: RecordPeriod) => void; onComingSoon: () => void;
}) {
  const [panel, setPanel] = useState<'kind' | 'period' | null>(null);
  function close() { setPanel(null); }
  return <div className="cash-filter-container" onKeyDown={event => { if (event.key === 'Escape') close(); }}>
    <div className="cash-filter-bar">
      <button type="button" aria-expanded={panel === 'kind'} aria-controls="cash-record-filters" onClick={() => setPanel(panel === 'kind' ? null : 'kind')}>
        {kind === 'all' ? t('copy.all') : kind==='withdrawal'?t('copy.withdraw'):t('copy.deposit')}<span aria-hidden="true">{panel === 'kind' ? '▴' : '▾'}</span>
      </button>
      <button type="button" aria-expanded={panel === 'period'} aria-controls="cash-record-filters" onClick={() => setPanel(panel === 'period' ? null : 'period')}>
        {periodLabels()[period]}<span aria-hidden="true">{panel === 'period' ? '▴' : '▾'}</span>
      </button>
    </div>
    {panel && <>
      <button className="cash-filter-backdrop" type="button" aria-label={t('copy.closeFilters')} onClick={close} />
      <div className="cash-filter-options" id="cash-record-filters" aria-label={panel === 'kind' ? t('copy.recordType') : t('copy.recordDate')}>
        {panel === 'kind' ? <>
          <button type="button" aria-pressed={kind === 'all'} onClick={() => { onKind('all'); close(); }}>{t('copy.all')}</button>
          <button type="button" aria-pressed={kind === 'deposit'} onClick={() => { onKind('deposit'); close(); }}>{t('copy.deposit')}</button>
          <button type="button" aria-pressed={kind==='withdrawal'} onClick={() => { onKind('withdrawal'); close(); }}>{t('copy.withdraw')}</button>
        </> : (Object.keys(periodLabels()) as RecordPeriod[]).map(value => <button type="button" key={value} aria-pressed={period === value}
          onClick={() => { onPeriod(value); close(); }}>{periodLabels()[value]}</button>)}
      </div>
    </>}
  </div>;
}
