import { PersistentDetails } from './PersistentDetails';
import { FreeTriggerStrategy } from './FreeTriggerStrategy';
import { createBasePrizePlan, streakProbability, validateStreakRules, type Parameters, type StreakRule, type FreeCompensationRow, type WeightTable } from '../domain/model';
import type { FreeTriggerRuleInput, StreakRuleInput } from '../domain/settings';
export const lossRuleDefaults: StreakRuleInput = { enabled: false, start: '', probability: '', interval: '', step: '', cap: '' };
export const winRuleDefaults: StreakRuleInput = { enabled: false, start: '', probability: '', interval: '', step: '', cap: '' };
export function StreakStrategies({ lossCompensation, freeCompensation, freeWinProbability, freeSessionMean, loss, win, baseProbability, baseTable, lineCount, freeCompensationRows, freeCompensationPending, freeRule, freeProbability, onFreeChange, onChange }: { lossCompensation: boolean; freeCompensation: boolean; freeWinProbability: number; freeSessionMean?: number; freeCompensationRows?: FreeCompensationRow[]; freeCompensationPending: boolean; baseTable: WeightTable | null; lineCount: number; freeRule?: FreeTriggerRuleInput; freeProbability: number; onFreeChange: (rule: FreeTriggerRuleInput) => void; baseProbability: number; loss?: StreakRuleInput; win?: StreakRuleInput; onChange: (key: 'lossStreakRule' | 'winStreakRule', rule: StreakRuleInput) => void }) {
  return <div className="streak-mode-groups"><PersistentDetails className="config-group config-mode-group" storageId="analysis.普通局" defaultOpen><summary>普通局</summary><section className="config-section streak-strategies"><p className="input-note">仅累计付费局。普通获得正奖金或触发免费均算中奖，同局只计一次；免费内部旋转不计数。中奖清零未中奖连计，未中奖清零中奖连计。</p>
    {([['lossStreakRule', '连续未中奖', loss ?? lossRuleDefaults], ['winStreakRule', '连续中奖', win ?? winRuleDefaults]] as const).map(([key, title, rule]) => <div className="streak-rule" key={key}>
      <label className="guarantee-option"><input type="checkbox" checked={rule.enabled} onChange={e => onChange(key, { ...rule, enabled: e.target.checked })} />{title}{key === 'lossStreakRule' ? '提升中奖率' : '降低中奖率'}</label>
      <fieldset disabled={!rule.enabled}>
        {([['start', '起始连续局数', '局'], ['probability', key === 'lossStreakRule' ? '起始提升到' : '起始降低到', '%'], ['interval', '之后每隔', '局'], ['step', key === 'lossStreakRule' ? '每次增加' : '每次减少', '个百分点'], ['cap', key === 'lossStreakRule' ? '最高值封顶局数' : '最低值封底局数', '局']] as const).map(([field, label, unit]) => <label className="field" key={field}><span>{label}</span><span className="input-wrap"><input aria-label={`${title}：${label}`} type="number" min={unit === '局' ? 1 : 0} max={unit === '局' ? 10000 : 100} step={unit === '局' ? 1 : 'any'} value={rule[field]} onChange={e => onChange(key, { ...rule, [field]: e.target.value })} /><span>{unit}</span></span></label>)}
      </fieldset>
      <StreakProbabilityPreview compensate={lossCompensation} baseTable={baseTable} lineCount={lineCount} rule={rule} loss={key === 'lossStreakRule'} baseProbability={baseProbability} />
      <p className="input-note">达到起始局数后，从下一付费局生效。封顶后保持该概率，直到连续状态改变；概率限制在 0%～100%。</p>
    </div>)}
  </section></PersistentDetails>
    <PersistentDetails className="config-group config-mode-group" storageId="analysis.免费局"><summary>免费局</summary><FreeTriggerStrategy compensationEnabled={freeCompensation} freeWinProbability={freeWinProbability} freeSessionMean={freeSessionMean} compensationRows={freeCompensationRows} pending={freeCompensationPending} value={freeRule} baseProbability={freeProbability} onChange={onFreeChange} /></PersistentDetails>
  </div>;
}

function StreakProbabilityPreview({ compensate, rule, loss, baseProbability, baseTable, lineCount }: { compensate: boolean; baseTable: WeightTable | null; lineCount: number; rule: StreakRuleInput; loss: boolean; baseProbability: number }) {
  if (!rule.enabled) return <p className="input-note">未启用，使用基础中奖率。</p>;
  const parsed = Object.fromEntries(Object.entries(rule).map(([key, value]) => [key, typeof value === 'string' ? (value.trim() ? Number(value) / (key === 'probability' || key === 'step' ? 100 : 1) : NaN) : value])) as unknown as StreakRule;
  const parameters: Parameters = { lineCount: 1, baseSpinWinProbability: baseProbability, freeSpinWinProbability: 0, freeSpinTriggerProbability: 0, [loss ? 'lossStreakRule' : 'winStreakRule']: parsed };
  try {
    if (!Number.isFinite(baseProbability) || baseProbability < 0 || baseProbability > 1) throw new Error();
    validateStreakRules(parameters);
  } catch { return <p className="input-note">填写有效配置后显示概率档位。</p>; }
  const thresholds: number[] = [];
  for (let k = parsed.start; k < parsed.cap; k += parsed.interval) thresholds.push(k);
  thresholds.push(parsed.cap);
  const plan=baseTable && Number.isSafeInteger(lineCount) && lineCount>0 ? createBasePrizePlan(baseTable,lineCount) : null;
  const compensation=(probability:number)=>{try{return plan?.profile(probability,baseProbability,loss && compensate)??null;}catch{return null;}};
  const format = (p: number) => `${(p * 100).toLocaleString('en-US', { maximumFractionDigits: 6 })}%`;
  return <div className="streak-probability-preview"><h3>中奖概率档位</h3><p>{loss ? compensate ? '提概率时自动提高第一档区间权重，保持 Base RTP；档内权重不变。' : '未启用 RTP 补偿，提升中奖率会改变 Base RTP。' : ''}按已连续{loss ? '未中奖' : '中奖'}局数，查看下一付费局普通中奖率。</p><div className="streak-preview-scroll"><table><thead><tr><th>连续局数</th><th>中奖率</th>{loss && <><th>第一档总权重</th><th>第一档占比</th><th>抽表平均倍率</th><th>Base RTP</th></>}</tr></thead><tbody>
    <tr><td>{parsed.start === 1 ? '0 局' : `0～${parsed.start - 1} 局`}</td><td>{format(baseProbability)}</td>{loss && <><td>{plan ? plan.tiers[0].weight.toLocaleString('en-US',{maximumFractionDigits:4}) : '—'}</td><td>{plan ? format(plan.profile(baseProbability,baseProbability,false).firstProbability) : '—'}</td><td>{plan ? `${plan.profile(baseProbability,baseProbability,false).multiplierMean.toFixed(6)}×` : '—'}</td><td>{plan ? format(plan.profile(baseProbability,baseProbability,false).mean) : '—'}</td></>}</tr>
    {thresholds.map((k, i) => { const probability=streakProbability(parameters,(loss?-1:1)*k),adjusted=compensation(probability);return <tr key={k}><td>{k === parsed.cap ? `≥ ${k} 局（${loss ? '封顶' : '封底'}）` : thresholds[i + 1] - 1 === k ? `${k} 局` : `${k}～${thresholds[i + 1] - 1} 局`}</td><td>{format(probability)}</td>{loss && <><td>{adjusted ? adjusted.firstTotalWeight === null ? '仅抽第一档' : adjusted.firstTotalWeight.toLocaleString('en-US',{maximumFractionDigits:4}) : '—'}</td><td>{adjusted ? format(adjusted.firstProbability) : '无法补偿'}</td><td>{adjusted ? `${adjusted.multiplierMean.toFixed(6)}×` : '—'}</td><td>{adjusted ? format(adjusted.mean) : '—'}</td></>}</tr>; })}
  </tbody></table></div></div>;
}
