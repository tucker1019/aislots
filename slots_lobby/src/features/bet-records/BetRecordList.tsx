import { serverText, t, getLocale } from '../../i18n';
import { message } from 'antd';
import { Icon } from '../../components/Icon';
import type { BetRecord } from '../../services/bet-records';
import { betMoney } from './money';
export function BetRecordList({ items }: { items: BetRecord[] }) {
  const [toast, holder] = message.useMessage();
  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(id); void toast.success(t('copy.transactionIdCopied')); }
    catch { void toast.error(t('copy.copyFailedPressAndHoldTheTransaction')); }
  };
  return <>{holder}{items.map((row, index) => {
    const day = new Date(row.createdAt).toLocaleDateString(getLocale());
    const previous = items[index - 1];
    return <div key={row.gameId + ':' + row.betId}>
      {(!previous || new Date(previous.createdAt).toLocaleDateString(getLocale()) !== day) && <h2 className="bet-record-day">{day}</h2>}
      <article className="bet-record-card">
        <header><strong>{row.provider || '—'}</strong><time dateTime={row.createdAt}>{t('copy.betTime')}{new Date(row.createdAt).toLocaleTimeString(getLocale(), { hour12: false })}</time></header>
        <div className="bet-record-body"><h3>{serverText(row.gameName || row.gameId)}</h3><div className="bet-record-amounts"><span>{t('copy.betAmount')} <b>{betMoney(row.betAmount)}</b></span><span>{t('copy.eligibleBets')} <b>{betMoney(row.validBet)}</b></span></div><p>{t('copy.netProfit')} <b className={row.profit < 0 ? 'bet-loss' : row.profit > 0 ? 'bet-gain' : ''}>{row.profit > 0 ? '+' : ''}{betMoney(row.profit)}</b></p><footer><span>{row.betId}</span><button type="button" aria-label={t('copy.copyTransactionIdValue', {p0: row.betId})} onClick={() => void copy(row.betId)}><Icon name="list" size={16} /></button></footer></div>
      </article>
    </div>;
  })}</>;
}
