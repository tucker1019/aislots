import { message } from 'antd';
import { Icon } from '../../components/Icon';
import type { BetRecord } from '../../services/bet-records';
import { betMoney } from './money';
export function BetRecordList({ items }: { items: BetRecord[] }) {
  const [toast, holder] = message.useMessage();
  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(id); void toast.success('交易 ID 已复制'); }
    catch { void toast.error('复制失败，请长按交易 ID 复制'); }
  };
  return <>{holder}{items.map((row, index) => {
    const day = new Date(row.createdAt).toLocaleDateString('zh-CN');
    const previous = items[index - 1];
    return <div key={row.gameId + ':' + row.betId}>
      {(!previous || new Date(previous.createdAt).toLocaleDateString('zh-CN') !== day) && <h2 className="bet-record-day">{day}</h2>}
      <article className="bet-record-card">
        <header><strong>{row.provider || '—'}</strong><time dateTime={row.createdAt}>投注时间：{new Date(row.createdAt).toLocaleTimeString('zh-CN', { hour12: false })}</time></header>
        <div className="bet-record-body"><h3>{row.gameName || row.gameId}</h3><div className="bet-record-amounts"><span>投注金额 <b>{betMoney(row.betAmount)}</b></span><span>有效投注 <b>{betMoney(row.validBet)}</b></span></div><p>净输赢 <b className={row.profit < 0 ? 'bet-loss' : row.profit > 0 ? 'bet-gain' : ''}>{row.profit > 0 ? '+' : ''}{betMoney(row.profit)}</b></p><footer><span>{row.betId}</span><button type="button" aria-label={`复制交易 ID ${row.betId}`} onClick={() => void copy(row.betId)}><Icon name="list" size={16} /></button></footer></div>
      </article>
    </div>;
  })}</>;
}
