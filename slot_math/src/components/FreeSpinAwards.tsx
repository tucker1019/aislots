import { resolveFreeSpinAwards, type WeightRow } from '../domain/model';
import type { FreeSpinAwardInput } from '../domain/settings';

export function FreeSpinAwards({ rows, onChange }: { rows: FreeSpinAwardInput[]; onChange: (rows: FreeSpinAwardInput[]) => void }) {
  let total = 0, mean: number | null = null, error = '';
  try {
    const distribution = resolveFreeSpinAwards({ freeSpinAwardWeights: rows.map(row => [row.spins.trim() ? Number(row.spins) : NaN, row.weight.trim() ? Number(row.weight) : NaN] as WeightRow) });
    total = distribution.totalWeight; mean = distribution.mean;
  } catch (e) { error = (e as Error).message; }
  function update(index: number, patch: Partial<FreeSpinAwardInput>) { onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  function add() {
    const counts = rows.map(row => Number(row.spins)).filter(Number.isSafeInteger);
    const largest = counts.reduce((max, value) => Math.max(max, value), 6);
    onChange([...rows, { spins: String(Number.isSafeInteger(largest + 2) ? largest + 2 : 8), weight: '1' }]);
  }
  return <div className="free-award-editor">
    <h3>免费局数权重</h3><p>每次触发后独立抽取局数，免费追加时也重新抽取。</p>
    <div className="free-award-labels"><span>赠送局数</span><span>权重</span><span>概率</span><span /></div>
    {rows.map((row, index) => <div className="free-award-row" key={index}>
      <input type="number" min="1" step="1" aria-label={`第${index + 1}项赠送免费局数`} value={row.spins} onChange={e => update(index, { spins: e.target.value })} />
      <input type="number" min="0" step="any" aria-label={`第${index + 1}项免费局数权重`} value={row.weight} onChange={e => update(index, { weight: e.target.value })} />
      <span>{mean === null ? '—' : `${(Number(row.weight) / total * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`}</span>
      <button disabled={rows.length <= 1} aria-label={`删除第${index + 1}项免费局数`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>×</button>
    </div>)}
    <button className="add-free-award" onClick={add}>＋ 添加局数</button>
    {error ? <p className="error" role="alert">{error}</p> : <div className="free-award-mean">每次触发平均赠送 <strong>{mean?.toLocaleString('en-US', { maximumFractionDigits: 6 })} 局</strong></div>}
    <p className="input-note">只配置一项时等同固定赠送；局数不除以线数。</p>
  </div>;
}
