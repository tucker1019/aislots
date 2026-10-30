import type { CascadeGame } from './useCascadeGame';

/** Column heights and line count; disabled while a demo run is in flight. */
export function BoardStructureSection({ game }: { game: CascadeGame }) {
  const { config, locked, shapeText, setShapeText, applyShape, heights } = game;
  return <section className="dev-section">
    <h2>棋盘结构</h2>
    <p>从左到右独立配置列高，或拖动棋盘上方的手柄。</p>
    <fieldset disabled={locked}>
      <label className="dev-field">各列格数
        <input aria-label="各列格数" value={shapeText} onChange={e => setShapeText(e.target.value)} placeholder="例如 2 3 4 4 3 2" />
      </label>
      <div className="dev-buttons">
        <button onClick={applyShape}>应用列高</button>
        <button disabled={config.columnHeights.length >= 12 || locked} onClick={() => heights([...config.columnHeights, 4])}>添加一列</button>
      </div>
      <label className="dev-field">线数
        <input aria-label="共享线数" value={config.lineCount} readOnly />
        <small>读取当前游戏 config.json；在数值分析页修改并保存。</small>
      </label>
    </fieldset>
  </section>;
}
