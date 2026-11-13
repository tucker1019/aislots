import { BasePrizeTiers } from './components/BasePrizeTiers';
import { PersistentDetails } from './components/PersistentDetails';
import { StreakStrategies } from './components/StreakStrategies';
import { FreeSpinAwards } from './components/FreeSpinAwards';
import { PageNav } from './components/PageNav';
import { WeightTableEditor } from './components/WeightTableEditor';
import { SimulationPanel } from './components/SimulationPanel';
import { useEffect, useMemo, useState } from 'react';
import { calculateModel } from './domain/model';

import { filesFromSettings, parametersFromInputs, settingsFromFiles, simulationOptionsFromFiles, type GameDocument, type LoadedTable } from './domain/settings';
import { saveGame } from './services/gameFiles';
import { useGameWorkspace } from './state/GameWorkspace';
import { GameFilesBar } from './components/GameFilesBar';
const number = (x: number, digits = 4) => x.toLocaleString('en-US', { maximumFractionDigits: digits });
const percent = (x: number) => `${number(x * 100)}%`;

export function App() {
  const { document, generation, loading, setAnalysisDirty, setAnalysisSaving, analysisSaved } = useGameWorkspace();
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">∑</span><span>Slot Math<span className="brand-sub">数值工作台</span></span></a><PageNav page="analysis"/><div className="header-status"><span />项目 JSON 文件</div></header>
    <main>
      <div className="page-heading"><div><h1>理论分析</h1><p>读取游戏文件调整数值，保存后供服务端使用。</p></div></div>
      <GameFilesBar />
      {document?.files.config.ruleType === 'paylines_v1' ? <div className="game-file-empty">连线玩法请进入 <a href="#/developer">开发页</a> 配置盘面、中奖组合和符号赔率。当前尚未接入倍率权重分析、盘面库及特殊玩法，不显示消除模型的 RTP。</div> : document ? <fieldset className="analysis-editor-fieldset" disabled={loading} aria-busy={loading}><AnalysisEditor key={`${document.gameId}:${generation}`} document={document} onDirtyChange={setAnalysisDirty} onSavingChange={setAnalysisSaving} onSaved={analysisSaved} /></fieldset> : <div className="game-file-empty">未加载配置。数值工具没有内置默认配置；数值始终从游戏 JSON 文件读取。</div>}
    </main>
  </div>;
}
function FileTable({ kind, value, onEdit }: { kind: 'base' | 'free'; value: LoadedTable; onEdit?: () => void }) {
  return <div className={`upload-block ${kind}`}>
    <div className="upload-heading"><span className="mode-dot" />{kind === 'base' ? '普通局倍率表' : '免费局倍率表'}</div>
    <div className="file-table-summary"><strong>{value.name}</strong><span>{number(value.table.rows.length, 0)} 条记录</span></div>
    <button className="edit-table-button" disabled={!onEdit} onClick={onEdit} aria-label={kind === 'base' ? '编辑普通局权重表' : '编辑免费局权重表'}>编辑权重表</button>
  </div>;
}

function AnalysisEditor({ document, onDirtyChange, onSavingChange, onSaved }: { document: GameDocument; onDirtyChange: (dirty: boolean) => void; onSavingChange: (saving: boolean) => void; onSaved: (document: GameDocument) => void }) {
  const [restoredSettings] = useState(() => settingsFromFiles(document.files));
  const [simulationOptions, setSimulationOptions] = useState(() => simulationOptionsFromFiles(document.files));
  const [revision, setRevision] = useState(document.revision);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [base, setBase] = useState<LoadedTable>(restoredSettings.base);
  const [free, setFree] = useState<LoadedTable>(restoredSettings.free);
  const [ruleType, setRuleType] = useState(restoredSettings.ruleType);
  const [inputs, setInputs] = useState(restoredSettings.inputs);
  const [editing, setEditing] = useState<'base' | 'free' | null>(null);
  const draftParameters = useMemo(() => parametersFromInputs(inputs), [inputs]);
  const fingerprint = JSON.stringify({ ruleType, inputs, base: base.table.rows, free: free.table.rows, simulationOptions });
  const [savedFingerprint, setSavedFingerprint] = useState(fingerprint);
  const dirty = fingerprint !== savedFingerprint;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  async function saveFiles() {
    if (saving || !dirty) return;
    setFileError(''); setSaveMessage('');
    try {
      const files = filesFromSettings({ ruleType, inputs, base, free }, simulationOptions);
      setSaving(true); onSavingChange(true);
      const result = await saveGame(document.gameId, revision, files);
      setRevision(result.revision); setSavedFingerprint(fingerprint);
      onSaved({ gameId: document.gameId, revision: result.revision, files });
      setSaveMessage('数值配置与两张倍率表已保存。理论结果与模拟仍按已应用配置运行。');
    } catch (e) { setFileError((e as Error).message); }
    finally { setSaving(false); onSavingChange(false); }
  }
  const [applied, setApplied] = useState(() => ({ inputs: restoredSettings.inputs, base: restoredSettings.base, free: restoredSettings.free, parameters: draftParameters }));
  const parameters = applied.parameters;
  const pendingChanges = inputs !== applied.inputs || base !== applied.base || free !== applied.free;
  const computed = useMemo(() => {
    if (!applied.base || !applied.free) return { result: null, error: '' };
    try { return { result: calculateModel(applied.base.table, applied.free.table, applied.parameters), error: '' }; }
    catch (e) { return { result: null, error: (e as Error).message }; }
  }, [applied]);
  function applyConfiguration() { setApplied({ inputs, base, free, parameters: draftParameters }); }
  const result = computed.result;
  const payoutMultiplier = (value: number | null | undefined) => value == null ? '—' : `${value > 0 && value < 1e-8 ? value.toExponential(4) : number(value, 8)}×`;
  const validLineCount = Number.isSafeInteger(draftParameters.lineCount) && draftParameters.lineCount > 0;
  return <div className="analysis-editor">
    {editing && <WeightTableEditor kind={editing} value={editing === 'base' ? base : free} other={editing === 'base' ? free : base} parameters={draftParameters} onSave={editing === 'base' ? setBase : setFree} onClose={() => setEditing(null)} />}
    <div className="analysis-file-heading"><span className={dirty ? 'file-dirty' : 'file-saved'} role="status">{saving ? '正在保存文件…' : dirty ? '有未保存到文件的修改' : '与已读取 / 保存的文件一致'}</span><div className="actions"><button className="button secondary" disabled={!pendingChanges} onClick={applyConfiguration}>应用配置</button><button className="button primary" disabled={!dirty || saving} onClick={() => void saveFiles()}>保存文件</button></div></div>
    {fileError && <div className="alert" role="alert">{fileError}</div>}
    {saveMessage && !dirty && <p className="game-file-success" role="status">{saveMessage}</p>}
      <div className="workspace">
        <aside className="configuration">
          <PersistentDetails className="config-group" storageId="analysis.基础配置" defaultOpen><summary>基础配置</summary>
          <section className="config-section"><label className="field"><span>玩法规则</span><select aria-label="玩法规则" value={ruleType} onChange={e => setRuleType(e.target.value)}>
            <option value="ways_cascade_v1">Ways 连续消除 · v1</option>
            <option value="paylines_v1">连线 · v1（盘面工具待实现）</option>
            <option value="cluster_cascade_v1">集群消除 · v1（盘面工具待实现）</option>
            {!['ways_cascade_v1', 'paylines_v1', 'cluster_cascade_v1'].includes(ruleType) && <option value={ruleType}>{ruleType}</option>}
          </select></label><p className="input-note">保存到当前游戏 config.json 的 ruleType，服务端据此选择开奖与验证实现。盘面工具支持 Ways 连续消除和可配置格子组合连线。</p></section>
          <PersistentDetails className="config-group config-subgroup" storageId="analysis.倍率权重表" defaultOpen><summary>倍率权重表</summary><section className="config-section"><p className="section-description">倍率表来自当前游戏目录。确认编辑后点击「保存文件」写回对应 JSON。</p><FileTable kind="base" value={base} onEdit={validLineCount ? () => setEditing('base') : undefined} /><FileTable kind="free" value={free} onEdit={validLineCount ? () => setEditing('free') : undefined} /><p className="weight-table-file-note">文件保存原始倍率，实际奖金 = 文件倍率 ÷ 线数 × 总投注。应用配置用于计算，保存文件用于写入磁盘。</p></section></PersistentDetails>
          <PersistentDetails className="config-group config-subgroup" storageId="analysis.开奖参数" defaultOpen><summary>开奖参数</summary><section className="config-section"><p className="section-description">修改后点击「应用配置」更新理论结果与模拟配置。</p>
            {([['lineCount', '线数', '线'], ['baseSpinWinProbability', '普通局中奖概率', '%'], ['freeSpinWinProbability', '免费局中奖概率', '%'], ['freeSpinTriggerProbability', '免费触发概率', '%']] as const).map(([key, label, unit]) => <label className="field" key={key}><span>{label}</span><span className="input-wrap"><input type="number" min={unit === '%' ? 0 : 1} max={unit === '%' ? 100 : undefined} step={unit === '%' ? 'any' : 1} value={inputs[key]} onChange={e => setInputs({ ...inputs, [key]: e.target.value })} /><span>{unit}</span></span></label>)}
            <p className="input-note">此处为基础免费触发率；高级免费策略仅调整付费局进入免费的概率，免费内部追加仍使用此值。</p>
            <label className="guarantee-option"><input type="checkbox" checked={inputs.freeSpinGuaranteedWin === true} onChange={e => setInputs({ ...inputs, freeSpinGuaranteedWin: e.target.checked })} /> 免费保底中奖一次</label>
            <p className="section-description">整段免费（含追加）至少获得一次正奖金。首次赠送 N 局后，均匀随机选择第 1～N 局保底；提前中奖则取消保底。追加免费正常开奖，整段只保底一次，保底从免费表正倍率按权重抽取。</p>
            <div className="free-retrigger-config"><h2>免费追加限制</h2>
              <label className="guarantee-option"><input type="checkbox" checked={inputs.freeRetriggerLimitEnabled === true} onChange={e => setInputs({ ...inputs, freeRetriggerLimitEnabled: e.target.checked })} /> 限制免费追加次数</label>
              <label className="field"><span>每段免费最多追加</span><span className="input-wrap"><input aria-label="免费最多追加次数" type="number" min="0" max="100" step="1" disabled={!inputs.freeRetriggerLimitEnabled} value={inputs.freeRetriggerLimit ?? ''} onChange={e => setInputs({ ...inputs, freeRetriggerLimit: e.target.value })} /><span>次</span></span></label>
              <p className="input-note">首次触发不计次数；免费内每次触发获得追加局数计 1 次。达到上限后不再追加，已有局数正常完成。0 表示禁止追加，关闭限制表示无限追加。</p>
            </div>
            <FreeSpinAwards rows={inputs.freeSpinAwards} onChange={freeSpinAwards => setInputs({ ...inputs, freeSpinAwards })} />
          </section>
          <div className="convention"><strong>计算口径</strong><p>总投注为 1，实际奖金 = 表内倍率 ÷ 线数 × 总投注。普通局与免费局使用相同线数，{inputs.freeRetriggerLimitEnabled ? `每段免费最多追加 ${inputs.freeRetriggerLimit ?? ''} 次。` : '免费允许无限次追加。'}</p></div></PersistentDetails>
          </PersistentDetails>
          <PersistentDetails className="config-group" storageId="analysis.高级配置"><summary>高级配置</summary>
            <PersistentDetails className="config-group config-subgroup" storageId="analysis.回归策略" defaultOpen><summary>回归策略</summary><StreakStrategies lossCompensation={inputs.lossStreakRtpCompensation} freeCompensation={inputs.freeTriggerRtpCompensation} freeWinProbability={draftParameters.freeSpinWinProbability} freeSessionMean={computed.result?.freeSessionMean} freeCompensationRows={computed.result?.freeCompensationRows} freeCompensationPending={pendingChanges} baseTable={base?.table ?? null} lineCount={draftParameters.lineCount} freeRule={inputs.freeTriggerRule} freeProbability={draftParameters.freeSpinTriggerProbability} onFreeChange={rule => setInputs({ ...inputs, freeTriggerRule: rule })} baseProbability={draftParameters.baseSpinWinProbability} loss={inputs.lossStreakRule} win={inputs.winStreakRule} onChange={(key, rule) => setInputs({ ...inputs, [key]: rule })} /></PersistentDetails>
          </PersistentDetails>
        </aside>
        <div className="analysis">
          {pendingChanges && <div className="simulation-notice stale" role="status">有未应用的修改。概率档位为当前输入预览；理论结果和模拟仍使用上次应用的配置。<button className="button primary" onClick={applyConfiguration}>应用配置</button></div>}
          {computed.error && <div className="alert" role="alert"><strong>请调整参数</strong><p>{computed.error}</p></div>}
          <section className="results-panel"><div className="panel-heading"><h2>回报率概览</h2><span className="status-pill">{result ? '理论计算' : '等待数据'}</span></div>
            <div className="rtp-layout"><div className="total-rtp"><span>Total RTP</span><strong>{result ? percent(result.totalRtp) : '—'}</strong><p>每次付费投注对应的全部奖金期望</p></div><div className="rtp-parts"><div><span><i className="legend base-color" />Base RTP</span><strong>{result ? percent(result.baseRtp) : '—'}</strong></div><div><span><i className="legend free-color" />Free RTP</span><strong>{result ? percent(result.freeRtp) : '—'}</strong></div><p>免费贡献包含所有追加免费局。</p></div></div>
            <div className="contribution-bar" aria-label="普通和免费 RTP 贡献"><div style={{ width: `${result && result.totalRtp > 0 ? result.baseRtp / result.totalRtp * 100 : 50}%` }} /><div /></div>
            {!applied.base || !applied.free ? <div className="empty-hint">请读取游戏文件后开始分析。</div> : null}
          </section>
          {(parameters.lossStreakRule?.enabled || parameters.winStreakRule?.enabled || parameters.freeTriggerRule?.enabled) && <section className="details-panel"><div className="panel-heading"><h2>回归策略影响</h2><span className="status-pill">长期理论值</span></div><dl className="detail-grid"><Detail label="基础配置 RTP" value={result ? percent(result.baselineTotalRtp) : '—'} /><Detail label="策略 RTP" value={result ? percent(result.totalRtp) : '—'} /><Detail label="长期平均普通中奖概率" value={result ? percent(result.effectiveBaseWinProbability) : '—'} /><Detail label="长期平均免费触发概率" value={result ? percent(result.effectiveFreeTriggerProbability) : '—'} /></dl><p className="table-footnote">普通中奖或触发免费延续连续中奖；普通无正奖金且未触发免费延续连续未中奖。{parameters.lossStreakRtpCompensation ? '连续未中奖提概率时，自动调整第一档区间权重保持基础 Base RTP；' : '普通奖 RTP 补偿未启用，中奖率策略会影响 Base RTP；'}连续中奖降概率仍影响 Base RTP；{parameters.freeTriggerRtpCompensation ? '免费触发提概率时自动降低整段免费中奖率，保持基础 Free RTP。' : '免费 RTP 补偿未启用，触发率策略会影响 Free RTP。'}理论按联合长期状态占比计算；触发免费后回到基础触发率，未触发次数重新累计。模拟从连续次数 0 开始。方差为单个付费局总奖金的长期边际方差，不代表多局累计奖金方差。</p></section>}
          <section className="metrics-grid"><Metric label="总奖金方差" value={result ? number(result.totalVariance) : '—'} note="包含免费触发与追加波动" /><Metric label="标准差" value={result ? number(result.standardDeviation) : '—'} note="单位投注奖金的标准差" /><Metric label="免费总局数期望" value={result ? number(result.freeSessionSpins) : '—'} note="每次触发后，含追加免费" /></section>
          <BasePrizeTiers table={applied.base?.table ?? null} lineCount={parameters.lineCount} />
          <SimulationPanel base={applied.base} free={applied.free} parameters={parameters} valid={!!result} options={simulationOptions} onOptionsChange={setSimulationOptions} />
          <section className="details-panel"><div className="panel-heading"><h2>平均中奖</h2><span className="muted">仅统计奖金大于 0 的旋转</span></div>
            <dl className="detail-grid">
              <Detail label="普通局平均中奖倍率" value={payoutMultiplier(result?.baseAverageWinMultiplier)} />
              <Detail label="免费局平均中奖倍率" value={payoutMultiplier(result?.freeAverageWinMultiplier)} />
              <Detail label="综合平均中奖倍率" value={payoutMultiplier(result?.overallAverageWinMultiplier)} />
              <Detail label="普通局实际中奖率" value={result ? percent(result.basePositiveProbability) : '—'} />
              <Detail label="免费局实际中奖率" value={result ? percent(result.freePositiveProbability) : '—'} />
              <Detail label="每付费局中奖次数期望" value={result ? number(result.expectedWinningSpinsPerPaidSpin) : '—'} />
            </dl><p className="table-footnote">平均中奖倍率 = 奖金期望 ÷ 实际中奖率，已除以线数；实际中奖率会排除表内 0 倍率。综合值按普通、免费（含追加）的预期中奖次数加权。无中奖可能时显示 —。</p>
          </section>
          <section className="details-panel"><div className="panel-heading"><h2>免费与波动指标</h2><span className="muted">以一次付费局为分析起点</span></div><dl className="detail-grid">
            <Detail label="每次触发平均赠送局数" value={result ? `${number(result.freeSpinsPerTriggerMean)} 局` : '—'} /><Detail label="每次赠送局数方差" value={result ? number(result.freeSpinsPerTriggerVariance) : '—'} /><Detail label="普通局奖金方差" value={result ? number(result.baseVariance) : '—'} /><Detail label="免费单局奖金方差" value={result ? number(result.freeSpinVariance) : '—'} /><Detail label="免费贡献方差" value={result ? number(result.freeContributionVariance) : '—'} /><Detail label="每次触发免费总奖金期望" value={result ? number(result.freeSessionMean) : '—'} /><Detail label="每付费局免费次数期望" value={result ? number(result.expectedFreeSpinsPerPaidSpin) : '—'} /><Detail label="免费追加系数" value={result ? `${number(result.reproduction)} / 1` : '—'} />
          </dl>{result && <div className={`stability ${parameters.freeRetriggerLimit === undefined && result.reproduction >= 0.8 ? 'warning' : ''}`}>{parameters.freeRetriggerLimit !== undefined ? `已限制每段免费最多追加 ${parameters.freeRetriggerLimit} 次，免费总局数及其矩有限。` : result.reproduction >= 0.8 ? '接近临界值，免费时长和奖金波动会显著增加。' : '免费追加系数小于 1，期望与方差有限。'}</div>}</section>
          <PersistentDetails className="formula-panel" storageId="analysis.计算公式与独立性假设"><summary>计算公式与独立性假设</summary><p>表内抽样与免费触发独立。开启回归策略时，普通中奖率及付费局免费触发率随各自连续状态变化，各付费局不再相互独立；理论按联合长期分布计算，奖金方差同时计入两种概率在不同状态下的相关性。开启免费保底时，随机选定的保底局可能强制中奖，免费单局指标按整段免费平均计算。表内倍率先除以线数。以下 μ、σ² 均指已计入中奖概率并按线数换算后的单局奖金均值和方差。</p><pre>{'q = 免费触发概率，N = 每次按权重抽取的局数\nμN = E[N]，vN = Var(N)，d = 1 − qμN\nE[T] = μN / d\nVar(K) = qvN + q(1 − q)μN²\nVar(T) = μN × Var(K) / d³ + vN / d²\nE[S] = E[T] × μ_free\nVar(S) = E[T] × σ²_free + Var(T) × μ_free²\nBase RTP = μ_base\nFree RTP = q × E[S]\nVar(总奖金) = σ²_base + q × Var(S) + q(1 − q) × E[S]²'}</pre><p>上述无限追加局数公式适用于未开启追加限制；限制开启时按剩余局数与剩余追加次数递推计算局数均值和二阶矩。上述奖金公式适用于未开启保底。保底开启时，令 J 为首次赠送局数内均匀随机选定的保底局，H 为前 J 局自然开奖全部零奖金的概率，Y 为免费表正倍率抽样奖金，则 E[S保底] = E[S] + H·E[Y]；方差同时计入保底奖金与后续自然奖金的相关性。T 是一次触发后的全部免费局数，S 是对应的全部免费奖金。计算使用双精度浮点数，显示值经过四舍五入。</p></PersistentDetails>
        </div>
      </div>
      <footer>Slot Math <span>理论分析 · 单位投注口径</span></footer>
  </div>;
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><p>{note}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
