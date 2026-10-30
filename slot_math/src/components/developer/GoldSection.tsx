import { NumericConfigInput } from '../NumericConfigInput';
import type { CascadeGame } from './useCascadeGame';

export function GoldSection({ game }: { game: CascadeGame }) {
  const {config, locked, changeConfig} = game;
  const gold = config.gold;
  return <section className="dev-section">
    <h2>金底规则</h2>
    <p>初始生成、顶部补充均独立判断。金底中奖转百搭，再参与掉落。</p>
    <fieldset className="dev-gold-settings" disabled={locked}>
      <label>普通金底概率（%）
        <NumericConfigInput aria-label="普通金底概率" min="0" max="100" step="any" value={gold.baseProbability * 100} onValueChange={value => changeConfig({gold: {...gold, baseProbability: value / 100}})} />
      </label>
      <label>免费金底概率（%）
        <NumericConfigInput aria-label="免费金底概率" min="0" max="100" step="any" value={gold.freeProbability * 100} onValueChange={value => changeConfig({gold: {...gold, freeProbability: value / 100}})} />
      </label>
      <div className="dev-gold-columns">金底轴
        {Array.from({length: Math.max(config.columnHeights.length, ...gold.columns)}, (_, i) => i + 1).map(column => <label key={column}>
          <input type="checkbox" aria-label={`第${column}轴启用金底`} checked={gold.columns.includes(column)} onChange={e => changeConfig({gold: {...gold, columns: e.target.checked ? [...gold.columns, column].sort((a,b) => a-b) : gold.columns.filter(c => c !== column)}})} />第 {column} 轴
        </label>)}
      </div>
      <label>金底转换百搭
        <select aria-label="金底转换百搭" value={gold.wildSymbolId ?? ''} onChange={e => changeConfig({gold: {...gold, wildSymbolId: e.target.value || null}})}>
          <option value="">请选择百搭</option>
          {config.symbols.filter(s => s.role === 'wild').map(s => <option key={s.id} value={s.id}>{s.name} · ID {s.id}</option>)}
        </select>
      </label>
      <p>基础 ID + 1000 为金底 ID。百搭不直接抽出，免费图标只参与骨架外补空。</p>
    </fieldset>
  </section>;
}
