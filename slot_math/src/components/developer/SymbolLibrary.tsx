import { NumericConfigInput } from '../NumericConfigInput';
import type { SymbolRole } from '../../domain/cascade';
import type { CascadeGame } from './useCascadeGame';

/** Symbol library plus the payout editor for the selected symbol. */
export function SymbolLibrary({ game }: { game: CascadeGame }) {
  const { config, locked, updateSymbol, addSymbol, removeSymbol, selectedSymbol, setSelectedSymbol, activeSymbol } = game;
  return <section className="dev-panel symbol-library">
    <div className="panel-heading">
      <div><h2>图标库 · Cell</h2><p>配置基础图标、生成权重与原始赔率；金底 ID 自动加 1000。</p></div>
      <button className="button primary" disabled={locked} onClick={addSymbol}>添加 Cell</button>
    </div>
    {!config.symbols.length
      ? <div className="dev-empty"><span>＋</span><strong>从第一个图标开始</strong><p>点击「添加 Cell」配置图标，再保存到当前游戏的 board.json。</p></div>
      : <>
        <div className="dev-symbol-table"><table>
          <thead><tr><th>图标 / 名称</th><th>抽取权重</th><th>类型</th><th>操作</th></tr></thead>
          <tbody>{config.symbols.map(symbol => <tr key={symbol.id}>
            <td><div className="symbol-name">
              <label className="symbol-color" style={{ background: symbol.color }}>
                <input aria-label={`${symbol.name}颜色`} type="color" value={symbol.color} disabled={locked} onChange={e => updateSymbol(symbol.id, { color: e.target.value })} />
                {symbol.name.slice(0, 1)}
              </label>
              <input aria-label={`${symbol.id}图标名称`} disabled={locked} value={symbol.name} onChange={e => updateSymbol(symbol.id, { name: e.target.value })} />
            <small className="dev-symbol-id">ID {symbol.id}{symbol.role === 'normal' && /^\d+$/.test(symbol.id) ? ` · 金底 ${Number(symbol.id) + 1000}` : ''}</small></div></td>
            <td><NumericConfigInput min="0" step="any" aria-label={`${symbol.name}权重`} disabled={locked || symbol.role === 'wild'} value={symbol.weight} onValueChange={value => updateSymbol(symbol.id, { weight: value })} /></td>
            <td><select aria-label={`${symbol.name}类型`} value={symbol.role} disabled={locked} onChange={e => updateSymbol(symbol.id, { role: e.target.value as SymbolRole, ...(e.target.value === 'wild' ? { weight: 0 } : {}) })}>
              <option value="normal">普通</option><option value="wild">百搭</option><option value="scatter">免费图标</option>
            </select></td>
            <td>
              <button className="text-button" disabled={locked} onClick={() => setSelectedSymbol(symbol.id)}>配置赔付</button>
              <button className="dev-delete" disabled={locked} aria-label={`删除${symbol.name}`} onClick={() => removeSymbol(symbol.id)}>删除</button>
            </td>
          </tr>)}</tbody>
        </table></div>
        {activeSymbol && <PayoutEditor game={game} />}
      </>}
  </section>;
}

function PayoutEditor({ game }: { game: CascadeGame }) {
  const { config, locked, activeSymbol, updateSymbol } = game;
  if (!activeSymbol) return null;
  return <div className="dev-payout-config">
    <h3>{activeSymbol.name} · 连续列数赔付</h3>
    {activeSymbol.role === 'normal'
      ? <>
        <div className="dev-pay-fields">
          {Array.from({ length: Math.max(0, config.columnHeights.length - 2) }, (_, i) => i + 3).map(columns => <label key={columns}>{columns} 列原始赔率
            <NumericConfigInput min="0" step="any" aria-label={`${activeSymbol.name}${columns}列原始赔率`}
              disabled={locked || !Number.isSafeInteger(config.lineCount) || config.lineCount < 1}
              value={activeSymbol.payouts[columns] ?? 0}
              onValueChange={value => updateSymbol(activeSymbol.id, { payouts: { ...activeSymbol.payouts, [columns]: value } })} />
          </label>)}
        </div>
        <p>输入规则表的原始赔率，例如填 3，实际为 3 ÷ 线数。最终倍率 = 原始赔率 ÷ 线数 × Ways 数量 × 本轮加成。</p>
      </>
      : <p>{activeSymbol.role === 'wild'
        ? '百搭权重固定为 0，只由金底中奖转换生成。百搭参与普通图标的 Ways，不单独派彩；全百搭组合不额外重复计算每个普通图标。'
        : '免费图标按权重参与骨架外补空，不参与骨架生成和 Ways 计奖。每轮每列最多新增1个，未中免费整局最多2个；本工具不赠送免费局。'}</p>}
  </div>;
}
