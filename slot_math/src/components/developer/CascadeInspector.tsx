import { cascadeFactor } from '../../domain/cascade';
import type { CascadeGame } from './useCascadeGame';
import { number, times } from './format';

/** Per-cascade breakdown: step tabs, win equations, and the before/after board toggle. */
export function CascadeInspector({ game }: { game: CascadeGame }) {
  const { round, rules, definitions, selectedStep, setSelectedStep, view, setView, actualSeed, step, winningNow } = game;
  return <section className="dev-panel cascade-inspector">
    <div className="panel-heading">
      <div>
        <h2>逐轮盘面检查</h2>
        <p>{actualSeed === null ? '生成盘面后查看计奖明细'
          : `本次流程种子 ${actualSeed} · ${!round ? '盘面预览' : round.finished ? '盘面检测完成' : round.limited ? '已达演示上限' : '盘面检测中'}`}</p>
      </div>
      {round && <span className="status-pill">{round.finished
        ? '检测完成'
        : `下一轮加成系数 ${cascadeFactor(rules, round.steps.length, round.mode)}`}</span>}
    </div>
    {round?.steps.length
      ? <>
        <div className="cascade-step-tabs">
          {round.steps.map((event, i) => <button key={i} className={selectedStep === i ? 'active' : ''} onClick={() => { setSelectedStep(i); setView('before'); }}>
            第 {event.index} 轮 · {times(event.payout)}
          </button>)}
        </div>
        <div className="cascade-view-toggle">
          <button className={view === 'before' ? 'active' : ''} onClick={() => setView('before')}>中奖盘面 / 消除位置</button>
          <button className={view === 'after' ? 'active' : ''} onClick={() => setView('after')}>掉落补齐 / 新图标</button>
        </div>
        {step && <div className="cascade-equations">
          {step.wins.map(win => <div key={win.symbolId}>
            <span className="win-symbol" style={{ color: definitions.get(win.symbolId)?.color }}>{definitions.get(win.symbolId)?.name}</span>
            <span>{win.columns} 列赔付 {times(win.payMultiplier)} × 数量 ({win.counts.join(' × ')}) × 加成系数 {number(win.factor)}</span>
            <strong>= {times(win.payout)}</strong>
          </div>)}
          <p>移除 {step.removedIds.length} 格；金底转百搭 {step.transformedIds.length} 格；顶部新补 {step.refillIds.length} 格。共用百搭分别计奖，只消除一次。</p>
        </div>}
      </>
      : <div className="dev-inspector-empty">{round
        ? round.finished
          ? '盘面无后续 Ways 中奖，检测完成。'
          : `当前可中奖图标 ${winningNow.length} 个。点击「下一轮消除 / 检测」查看结果。`
        : '添加图标并配置后，生成随机盘面或从手动盘面测试。'}</div>}
  </section>;
}
