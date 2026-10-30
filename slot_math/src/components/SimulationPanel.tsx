import { memo, useEffect, useRef, useState } from 'react';
import { BASE_PRIZE_EDGES, calculateModel, resolveFreeSpinAwards, type Parameters } from '../domain/model';
import { type LoadedTable, type SimulationOptions } from '../domain/settings';
import { simulationFreeTriggerStages, simulationStrategyStages, summarizeSimulation, type SimulationMessage, type SimulationProgress, type SimulationRequest } from '../domain/simulation';

const number = (value: number, digits = 4) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const percent = (value: number) => `${number(value * 100)}%`;
const multiplier = (value: number | undefined) => value === undefined ? '—' : `${value > 0 && value < 1e-8 ? value.toExponential(4) : number(value, 8)}×`;
type Props = { base: LoadedTable | null; free: LoadedTable | null; parameters: Parameters; valid: boolean; options: SimulationOptions; onOptionsChange: (options: SimulationOptions) => void };
type Run = { request: SimulationRequest; base: LoadedTable; free: LoadedTable; theory: ReturnType<typeof calculateModel> };
type Status = 'idle' | 'running' | 'complete' | 'cancelled' | 'error';
function SimulationPanelView({ base, free, parameters, valid, options, onOptionsChange: setOptions }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [progress, setProgress] = useState<SimulationProgress | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const latestProgress = useRef<SimulationProgress | null>(null);
  useEffect(() => () => workerRef.current?.terminate(), []);
  const running = status === 'running';
  const changed = run && (run.base !== base || run.free !== free || JSON.stringify(run.request.parameters) !== JSON.stringify(parameters));
  const summary = progress ? summarizeSimulation(progress.stats) : null;
  const count = progress?.stats.completedPaidSpins ?? 0;
  const completion = run ? count / run.request.paidSpins : 0;
  function start() {
    if (!base || !free || !valid || running) return;
    try {
      const paidSpins = options.count.trim() ? Number(options.count) : NaN;
      if (!Number.isSafeInteger(paidSpins) || paidSpins < 1 || paidSpins > 1_000_000_000) throw new Error('付费局数请输入 1 到 10 亿之间的整数。');
      const seed = options.seed.trim() ? Number(options.seed) : crypto.getRandomValues(new Uint32Array(1))[0];
      if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('随机种子请输入 0 到 4294967295 之间的整数，或留空。');
      const theory = calculateModel(base.table, free.table, parameters);
      const request = { baseRows: base.table.rows, freeRows: free.table.rows, parameters: structuredClone(parameters), paidSpins, seed };
      workerRef.current?.terminate();
      const worker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = ({ data }: MessageEvent<SimulationMessage>) => {
        if (workerRef.current !== worker) return;
        if (data.type === 'error') { setError(data.message); setStatus('error'); worker.terminate(); workerRef.current = null; return; }
        latestProgress.current = data.progress;
        setProgress(data.progress);
        if (data.progress.done) { setStatus('complete'); worker.terminate(); workerRef.current = null; }
      };
      worker.onerror = () => { if (workerRef.current !== worker) return; setError('模拟线程运行失败，请重试。'); setStatus('error'); worker.terminate(); workerRef.current = null; };
      latestProgress.current = null; setProgress(null); setRun({ request, base, free, theory }); setError(''); setStatus('running');
      worker.postMessage(request);
    } catch (e) { setError((e as Error).message); }
  }
  function cancel() { workerRef.current?.terminate(); workerRef.current = null; setProgress(latestProgress.current); setStatus('cancelled'); }
  const awards = run ? resolveFreeSpinAwards(run.request.parameters) : null;
  const awardWeights = new Map<number, number>();
  for (const [spins, weight] of awards?.rows ?? []) awardWeights.set(spins, (awardWeights.get(spins) ?? 0) + weight);
  const awardDraws = Object.values(progress?.stats.freeAwardCounts ?? {}).reduce((sum, count) => sum + count, 0);
  const waitIntervals = [10, 20, 50, 100, 200, 500, 1000, Infinity];
  const waitBucketCounts = new Array<number>(waitIntervals.length).fill(0);
  for (const [wait, frequency] of Object.entries(progress?.stats.freeWaitCounts ?? {})) {
    const index = waitIntervals.findIndex(upper => Number(wait) <= upper);
    waitBucketCounts[index] += frequency;
  }
  let cumulativeWaits = 0;
  const comparisons = run ? [
    ['Total RTP', summary?.totalRtp, run.theory.totalRtp, 'percent'],
    ['Base RTP', summary?.baseRtp, run.theory.baseRtp, 'percent'],
    ['Free RTP', summary?.freeRtp, run.theory.freeRtp, 'percent'],
    ['付费局免费触发率', summary?.effectiveFreeTriggerProbability, run.theory.effectiveFreeTriggerProbability, 'percent'],
    ['总奖金方差', summary?.totalVariance, run.theory.totalVariance, 'number'],
    ['标准差', summary?.standardDeviation, run.theory.standardDeviation, 'number'],
    ['普通局平均中奖倍率', summary?.baseAverageWinMultiplier, run.theory.baseAverageWinMultiplier, 'multiplier'],
    ['免费局平均中奖倍率', summary?.freeAverageWinMultiplier, run.theory.freeAverageWinMultiplier, 'multiplier'],
    ['综合平均中奖倍率', summary?.overallAverageWinMultiplier, run.theory.overallAverageWinMultiplier, 'multiplier'],
    ['普通局实际中奖率', summary?.basePositiveProbability, run.theory.basePositiveProbability, 'percent'],
    ['免费局实际中奖率', summary?.freePositiveProbability, run.theory.freePositiveProbability, 'percent'],
    ['每次触发免费总局数', summary?.freeSessionSpins, run.theory.freeSessionSpins, 'number'],
  ] as const : [];
  const format = (x: number | null | undefined, kind: string) => x == null ? '—' : kind === 'percent' ? percent(x) : kind === 'multiplier' ? multiplier(x) : number(x);
  return <section className="simulation-panel">
    <div className="panel-heading"><h2>模拟验证</h2><span className={`status-pill ${running ? 'simulation-running' : ''}`} role="status">{{ idle: '准备运行', running: '正在模拟', complete: '已完成', cancelled: '已取消', error: '运行失败' }[status]}</span></div>
    <p className="simulation-description">按真实开奖流程逐局抽样，每个付费局包含它触发的全部免费与追加免费。</p>
    <div className="simulation-controls"><label className="field"><span>付费局数</span><input type="number" min="1" max="1000000000" step="1" value={options.count} disabled={running} onChange={e => setOptions({ ...options, count: e.target.value })} /></label><label className="field"><span>随机种子（留空随机）</span><input type="number" min="0" max="4294967295" step="1" value={options.seed} disabled={running} placeholder="相同种子可复现结果" onChange={e => setOptions({ ...options, seed: e.target.value })} /></label><button className="button primary" disabled={!valid || running} onClick={start}>开始模拟</button>{running && <button className="button secondary" onClick={cancel}>取消模拟</button>}</div>
    <div className="simulation-presets">{[100_000, 1_000_000, 10_000_000].map(value => <button disabled={running} key={value} onClick={() => setOptions({ ...options, count: String(value) })}>{number(value / 10_000, 0)} 万局</button>)}<span>计数只包含付费普通局</span></div>
    {error && <div className="simulation-notice error" role="alert">{error}</div>}
    {!valid && <p className="simulation-notice">请先读取游戏文件，并应用有效参数。</p>}
    {changed && <div className="simulation-notice stale" role="status">当前参数或权重表已更改。下方模拟和理论对比仍使用本次启动时的快照，请重新运行以验证当前设置。</div>}
    {run && <>
      <div className="simulation-progress"><div><strong>{number(completion * 100, 2)}%</strong><span>{number(count, 0)} / {number(run.request.paidSpins, 0)} 付费局</span><span>耗时 {number((progress?.elapsedMs ?? 0) / 1000, 1)} 秒</span></div><progress aria-label="模拟进度" value={count} max={run.request.paidSpins} /></div>
      <div className="simulation-snapshot"><span>普通表：{run.base.name}</span><span>免费表：{run.free.name}</span><span>线数：{run.request.parameters.lineCount}</span><span>种子：{run.request.seed}</span><span>普通中奖：{percent(run.request.parameters.baseSpinWinProbability)}</span><span>未中奖提概率的第一档 RTP 补偿：{run.request.parameters.lossStreakRtpCompensation ? '自动' : '未启用'}</span><span>免费中奖：{percent(run.request.parameters.freeSpinWinProbability)}</span><span>基础免费触发 / 免费内追加：{percent(run.request.parameters.freeSpinTriggerProbability)}</span><span>付费局免费策略：{run.request.parameters.freeTriggerRule?.enabled ? '已启用' : '未启用'}</span><span>免费中奖率补偿：{run.request.parameters.freeTriggerRtpCompensation ? '自动，整段锁定' : '未启用'}</span><span>免费追加上限：{run.request.parameters.freeRetriggerLimit === undefined ? '无限' : `${run.request.parameters.freeRetriggerLimit} 次`}</span><span>随机赠送：{awards?.rows.map(([spins, weight]) => `${spins}局(权重${number(weight)})`).join('、')}</span></div>
      <div className="table-scroll"><table><thead><tr><th>指标</th><th>启动时理论值</th><th>模拟值</th><th>差值</th></tr></thead><tbody>{comparisons.map(([label, observed, expected, kind]) => <tr key={label}><td>{label}</td><td>{format(expected, kind)}</td><td>{format(observed, kind)}</td><td>{observed == null || expected == null ? '—' : `${observed - expected > 0 ? '+' : ''}${kind === 'percent' ? `${number((observed - expected) * 100)} 个百分点` : format(observed - expected, kind)}`}</td></tr>)}</tbody></table></div>
      <div className="simulation-counts"><span>免费局数 <strong>{number(progress?.stats.freeSpins ?? 0, 0)}</strong></span><span>普通中奖 <strong>{number(progress?.stats.baseWins ?? 0, 0)}</strong></span><span>免费中奖 <strong>{number(progress?.stats.freeWins ?? 0, 0)}</strong></span></div>
      <div className="simulation-maxima">
        <div><span>最大连续中奖</span><strong>{count > 0 ? `${number(progress?.stats.maximumWinningStreak ?? 0, 0)} 局` : '—'}</strong><p>普通正奖金或触发免费均算中奖</p></div>
        <div><span>最大连续未中奖</span><strong>{count > 0 ? `${number(progress?.stats.maximumLosingStreak ?? 0, 0)} 局` : '—'}</strong><p>普通无正奖金且未触发免费</p></div>
      </div>
      <div className="simulation-award-distribution"><h3>普通奖区间抽样统计</h3><p>普通命中奖率后先抽区间，再按该区间内原权重抽倍率。{run.request.parameters.lossStreakRtpCompensation ? '连续未中奖提概率时仅调整第一档区间总权重，保持基础 Base RTP。' : '普通奖 RTP 补偿未启用。'}{run.request.parameters.freeTriggerRtpCompensation ? '免费触发提概率另外通过降低免费中奖率保持 Free RTP。' : '免费 RTP 补偿未启用。'}</p><div className="table-scroll"><table><thead><tr><th>实际倍率区间</th><th>抽中次数</th><th>抽表占比</th></tr></thead><tbody>{BASE_PRIZE_EDGES.map((lower,i)=>{const frequency=progress?.stats.basePrizeTierCounts?.[i]??0,total=Object.values(progress?.stats.basePrizeTierCounts??{}).reduce((sum,n)=>sum+n,0);return <tr key={lower}><td>{i===BASE_PRIZE_EDGES.length-1?'≥ 200×':`${lower}～${BASE_PRIZE_EDGES[i+1]}×`}</td><td>{number(frequency,0)}</td><td>{total?percent(frequency/total):'—'}</td></tr>;})}</tbody></table></div></div>
      <div className="simulation-award-distribution"><h3>策略档位生效统计</h3><p>次数为实际使用该档中奖率开奖的已完成付费局数；按开奖前的连续次数归档。封顶后每局继续计入封顶档，同一付费局只计一档，合计等于已完成付费局数。免费内部不计数，连续长度不受策略封顶局数限制。</p><div className="table-scroll"><table><thead><tr><th>策略档位</th><th>开奖前连续局数</th><th>普通中奖率</th><th>生效次数</th><th>付费局占比</th></tr></thead><tbody>{simulationStrategyStages(run.request.parameters).map(stage => { const uses = progress?.stats.strategyStageCounts?.[stage.key] ?? 0; return <tr key={stage.key}><td>{stage.label}</td><td>{stage.range}</td><td>{percent(stage.probability)}</td><td>{number(uses, 0)}</td><td>{count ? percent(uses / count) : '—'}</td></tr>; })}</tbody></table></div></div>
      {run.request.parameters.freeTriggerRule?.enabled && <div className="simulation-award-distribution"><h3>免费触发策略档位统计</h3><p>只按付费局开奖前的未触发免费次数归档，普通中奖不重置；各档合计等于已完成付费局数。免费内部追加不计入。</p><div className="table-scroll"><table><thead><tr><th>档位</th><th>免费触发率</th><th>免费中奖率</th><th>整段免费EV</th><th>Free RTP</th><th>生效次数</th><th>付费局占比</th></tr></thead><tbody>{simulationFreeTriggerStages(run.request.parameters).map(stage => { const uses = progress?.stats.freeTriggerStageCounts?.[stage.key] ?? 0; const adjusted=run.theory.freeCompensationRows.find(row=>Math.abs(row.triggerProbability-stage.probability)<1e-12); return <tr key={stage.key}><td>{stage.label}</td><td>{percent(stage.probability)}</td><td>{adjusted ? percent(adjusted.freeWinProbability) : percent(run.request.parameters.freeSpinWinProbability)}</td><td>{adjusted ? multiplier(adjusted.sessionMean) : multiplier(run.theory.freeSessionMean)}</td><td>{percent(adjusted?.freeRtp ?? stage.probability*run.theory.freeSessionMean)}</td><td>{number(uses, 0)}</td><td>{count ? percent(uses / count) : '—'}</td></tr>; })}</tbody></table></div></div>}
      <div className="simulation-award-distribution free-wait-distribution"><h3>免费等待分布</h3><p>只数付费局，包含触发免费的当局。第一次从模拟开始计数，之后从上次触发后的下一付费局计数；普通中奖不重置，免费内部旋转与追加不计数。均值、P95 和区间分布只统计完整等待。</p>
        <div className="simulation-maxima">
          <div><span>平均等待</span><strong>{summary?.averageFreeWait == null ? '—' : `${number(summary.averageFreeWait, 2)} 局`}</strong><p>长期理论：{run.theory.effectiveFreeTriggerProbability > 0 ? `${number(1 / run.theory.effectiveFreeTriggerProbability, 2)} 局` : '无免费触发'}</p></div>
          <div><span>最长观测等待</span><strong>{summary?.observedLongestFreeWait == null ? '—' : `${(summary.incompleteFreeWait ?? 0) > (summary.maximumCompletedFreeWait ?? 0) ? '≥ ' : ''}${number(summary.observedLongestFreeWait, 0)} 局`}</strong><p>包含尚未触发的尾段；尾段更长时标记 ≥</p></div>
          <div><span>95% 等待在多少局以内</span><strong>{summary?.freeWaitP95 == null ? '—' : `${number(summary.freeWaitP95, 0)} 局`}</strong><p>完整等待样本的第 95 百分位</p></div>
        </div>
        <p>完整等待 {number(progress?.stats.freeTriggers ?? 0, 0)} 次；当前尚未触发尾段 {number(progress?.stats.currentFreeWait ?? 0, 0)} 局，未纳入平均值和 P95。{!progress?.stats.freeTriggers ? ' 尚无完整样本。' : ''}</p>
        <div className="table-scroll"><table><thead><tr><th>等待付费局数</th><th>次数</th><th>占比</th><th>累计占比</th></tr></thead><tbody>{waitIntervals.map((upper, index) => { const frequency = waitBucketCounts[index]; cumulativeWaits += frequency; const total = progress?.stats.freeTriggers ?? 0; return <tr key={String(upper)}><td>{upper === Infinity ? '> 1,000 局' : `${index === 0 ? 1 : waitIntervals[index - 1] + 1}～${number(upper, 0)} 局`}</td><td>{number(frequency, 0)}</td><td>{total ? percent(frequency / total) : '—'}</td><td>{total ? percent(cumulativeWaits / total) : '—'}</td></tr>; })}</tbody></table></div>
      </div>
      <div className="simulation-award-distribution"><h3>免费局数抽取统计</h3><p>首次触发与免费中追加均独立抽取；局数保持整数，不除以线数。</p><div className="table-scroll"><table><thead><tr><th>赠送局数</th><th>理论占比</th><th>首次抽中</th><th>追加抽中</th><th>合计次数</th><th>实际占比</th></tr></thead><tbody>{[...awardWeights].map(([spins, weight]) => <tr key={spins}><td>{number(spins, 0)} 局</td><td>{awards ? percent(weight / awards.totalWeight) : '—'}</td><td>{number(progress?.stats.initialFreeAwardCounts?.[spins] ?? 0, 0)}</td><td>{number(progress?.stats.retriggerFreeAwardCounts?.[spins] ?? 0, 0)}</td><td>{number(progress?.stats.freeAwardCounts?.[spins] ?? 0, 0)}</td><td>{awardDraws > 0 ? percent((progress?.stats.freeAwardCounts?.[spins] ?? 0) / awardDraws) : '—'}</td></tr>)}</tbody></table></div></div>
      <div className="simulation-maxima">
        <div><span>总最高中奖倍率</span><strong>{count > 0 && progress ? multiplier(progress.stats.maximumSessionPayout) : '—'}</strong><p>单次普通局 + 它触发的整轮免费</p></div>
        <div><span>Base 最高中奖倍率</span><strong>{count > 0 && progress ? multiplier(progress.stats.maximumBasePayout) : '—'}</strong><p>单次普通局奖金</p></div>
        <div><span>Free 最高中奖倍率</span><strong>{progress && progress.stats.freeTriggers > 0 ? multiplier(progress.stats.maximumFreeSessionPayout) : '—'}</strong><p>整轮免费合计，包含所有追加免费</p></div>
      </div>
      <p className="table-footnote">最高倍率为本次模拟实际观测值，均已除以线数；总最高倍率不等于 Base 与 Free 最高倍率相加。未触发免费时 Free 显示 —。结果只统计已完整结束的付费流程；取消时保留最近一次进度，不计未完成流程。方差使用样本方差（N − 1），不足两局显示 —。随机结果会波动，不要求精确等于理论值。{status === 'cancelled' ? ' 取消产生的部分结果仅供排查，不作为完整模拟结论。' : ''}</p>
    </>}
  </section>;
}

export const SimulationPanel = memo(SimulationPanelView);
