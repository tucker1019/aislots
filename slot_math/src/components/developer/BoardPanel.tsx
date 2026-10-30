import { type CSSProperties } from 'react';
import type { CascadeGame } from './useCascadeGame';
import { number, times } from './format';

/** Draggable board plus the spin / cascade / autoplay controls below it. */
export function BoardPanel({ game }: { game: CascadeGame }) {
  const {
    config, mode, changeMode, freeTarget, changeFreeTarget, placeGold, setPlaceGold, locked, configError, activeSymbol, selectedSymbol, setSelectedSymbol,
    board, highlights, view, grid, definitions,
    fillPreview, clearPlay, startSpin, nextStep, autoplay, setAutoplay,
    seed, setSeed, heights, removeColumn, moveColumn, draggedColumn,
    beginResize, moveResize, resizing, placeSymbol, round,
  } = game;
  return <section className="dev-panel board-panel">
    <div className="panel-heading">
      <div><h2>棋盘工作区</h2><p>{config.columnHeights.join(' · ')} <span>共 {config.columnHeights.reduce((a, b) => a + b, 0)} 格</span></p></div>
      <div className="dev-buttons">
        <button disabled={locked || !!configError} onClick={fillPreview}>按补空策略填满</button>
        <button disabled={!round} onClick={clearPlay}>清空检测</button>
      </div>
    </div>

    <div className="dev-board-toolbar">
      <label>放置图标
        <select aria-label="选择放置图标" value={activeSymbol?.id ?? ''} disabled={locked || !config.symbols.length} onChange={e => setSelectedSymbol(e.target.value)}>
          {!config.symbols.length && <option value="">先添加图标</option>}
          {config.symbols.map(symbol => <option value={symbol.id} key={symbol.id}>{symbol.name}</option>)}
        </select>
      </label>
      <label className="dev-gold-toggle"><input type="checkbox" aria-label="放置金底图标" checked={placeGold} disabled={locked} onChange={e => setPlaceGold(e.target.checked)} />金底</label>
      <span>{locked ? '演示使用启动时配置；清空检测后可编辑。' : '点击格子可放置选定图标；拖动列顶手柄改变格数。'}</span>
    </div>

    <div className="dev-board-scroll">
      <div className="dev-board" style={{ '--columns': config.columnHeights.length } as CSSProperties}>
        {config.columnHeights.map((height, c) => <div className="dev-reel" key={c}
          onDragOver={e => { if (!locked) e.preventDefault(); }}
          onDrop={e => {
            e.preventDefault();
            const from = draggedColumn.current;
            if (from === null || from === c || locked) return;
            moveColumn(from, c);
            draggedColumn.current = null;
          }}>
          <div className="reel-label" draggable={!locked} onDragStart={() => { draggedColumn.current = c; }} onDragEnd={() => { draggedColumn.current = null; }} title="左右拖动调整列顺序">
            <span>第 {c + 1} 列</span>
            <button aria-label={`删除第${c + 1}列`} disabled={locked || config.columnHeights.length <= 3} onClick={() => removeColumn(c)}>×</button>
          </div>
          <button className="reel-resize" disabled={locked} aria-label={`第${c + 1}列高度，当前${height}格，上下拖动调整`}
            onPointerDown={e => beginResize(e, c)} onPointerMove={moveResize}
            onPointerUp={() => { resizing.current = null; }} onPointerCancel={() => { resizing.current = null; }}
            onKeyDown={e => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
              e.preventDefault();
              heights(config.columnHeights.map((x, i) => i === c ? Math.max(1, Math.min(12, x + (e.key === 'ArrowUp' ? 1 : -1))) : x));
            }}>⠿ <span>{height} 格</span></button>
          <div className="reel-cells">
            {Array.from({ length: height }, (_, r) => {
              const cell = board?.[c]?.[r];
              const symbolId = cell?.symbolId ?? grid[c]?.[r];
              const symbol = definitions.get(symbolId ?? '');
              const marked = cell && highlights.has(cell.id);
              return <button key={cell?.id ?? `empty-${c}-${r}`}
                className={`game-cell ${symbol?.role ?? 'empty'} ${symbol?.gold ? 'gold' : ''} ${marked ? (view === 'before' ? 'winning' : 'refilled') : ''}`}
                style={{ '--symbol-color': symbol?.color ?? '#a6b4cb' } as CSSProperties}
                disabled={locked}
                aria-label={`第${c + 1}列第${r + 1}格，${symbol?.name ?? '空格'}`}
                onClick={() => placeSymbol(c, r)}>
                <strong>{symbol?.role === 'wild' ? 'W' : symbol?.role === 'scatter' ? '免' : symbol?.gold ? definitions.get(symbol.baseSymbolId)?.name.slice(0, 2) : symbol?.name.slice(0, 2) ?? '＋'}</strong>
                <span>{symbol?.name ?? '空格'}</span>
              </button>;
            })}
          </div>
          <div className="reel-height-input">
            <button disabled={locked || height <= 1} aria-label={`减少第${c + 1}列格数`} onClick={() => heights(config.columnHeights.map((x, i) => i === c ? x - 1 : x))}>−</button>
            <span>{height}</span>
            <button disabled={locked || height >= 12} aria-label={`增加第${c + 1}列格数`} onClick={() => heights(config.columnHeights.map((x, i) => i === c ? x + 1 : x))}>＋</button>
          </div>
        </div>)}
      </div>
    </div>

    <div className="dev-play-controls">
      <label>检测模式<select aria-label="检测模式" value={mode} disabled={locked} onChange={e => changeMode(e.target.value === 'free' ? 'free' : 'base')}>
        <option value="base">普通</option><option value="free">免费</option>
      </select></label>
      <label>免费表现（仅测试）<select aria-label="免费图标目标" value={freeTarget} disabled={locked} onChange={e=>changeFreeTarget(Number(e.target.value) as 0|3|4|5)}>
        <option value="0">未中免费：最多2个</option><option value="3">已中免费：3个</option><option value="4">已中免费：4个</option><option value="5">已中免费：5个</option>
      </select></label>
      <label>随机种子<input type="number" min="0" max="4294967295" placeholder="留空随机" value={seed} disabled={locked} onChange={e => setSeed(e.target.value)} /></label>
      <button className="button primary" disabled={!!configError || !!(round && !round.finished)} onClick={() => startSpin(false)}>生成随机盘面</button>
      <button className="button secondary" disabled={!!configError || locked} onClick={() => startSpin(true)}>从当前盘面测试</button>
      <button className="button secondary" disabled={!round || round.finished || round.limited || autoplay} onClick={nextStep}>下一轮消除 / 检测</button>
      <button className="button secondary" disabled={!round || round.finished || round.limited} onClick={() => setAutoplay(x => !x)}>{autoplay ? '暂停自动' : '自动检测'}</button>
    </div>
    {configError && <p className="dev-inline-note">{configError}</p>}
  </section>;
}

/** Four headline numbers for the current demo session. */
export function SessionMetrics({ game }: { game: CascadeGame }) {
  const { round, winningNow, config, mode } = game;
  return <section className="dev-session-metrics">
    <div><span>盘面累计中奖倍率</span><strong>{times(round?.totalPayout ?? 0)}</strong><small>{(round?.mode ?? mode) === 'free' ? '免费' : '普通'} · 以总投注 1 为基准</small></div>
    <div><span>已消除轮数</span><strong>{number(round?.steps.length ?? 0, 0)}</strong><small>单次盘面的消除链</small></div>
    <div><span>当前中奖组合</span><strong>{number(winningNow.length, 0)}</strong><small>本轮可消除的 Ways 组合</small></div>
    <div><span>盘面状态</span><strong>{!round ? '待生成' : round.limited ? '达到上限' : round.finished ? '检测完成' : '检测中'}</strong><small>{config.columnHeights.length} 列 · 共 {config.columnHeights.reduce((a,b) => a+b,0)} 格</small></div>
  </section>;
}
