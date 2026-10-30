import { freeTriggerProbability, validateFreeTriggerRule, type FreeTriggerRule, type FreeCompensationRow, type Parameters } from '../domain/model';
import type { FreeTriggerRuleInput } from '../domain/settings';
export function FreeTriggerStrategy({ compensationEnabled, freeWinProbability, freeSessionMean, value, baseProbability, onChange, compensationRows, pending }: { compensationEnabled: boolean; freeWinProbability: number; freeSessionMean?: number; value?: FreeTriggerRuleInput; baseProbability: number; onChange: (rule: FreeTriggerRuleInput) => void; compensationRows?: FreeCompensationRow[]; pending: boolean }) {
  const rule = value ?? { enabled: false, start: '', interval: '', step: '', cap: '' };
  const parsed = { enabled: rule.enabled, ...Object.fromEntries((['start','interval','step','cap'] as const).map(key => [key, rule[key].trim() ? Number(rule[key]) / (key === 'step' ? 100 : 1) : NaN])) , probability: rule.step.trim() ? Math.min(1,baseProbability+Number(rule.step)/100) : NaN } as FreeTriggerRule;
  const p: Parameters = { lineCount: 1, baseSpinWinProbability: 0, freeSpinWinProbability: 0, freeSpinTriggerProbability: baseProbability, freeTriggerRule: parsed,freeTriggerRtpCompensation:compensationEnabled };
  let valid = Number.isFinite(baseProbability) && baseProbability >= 0 && baseProbability <= 1;
  try { validateFreeTriggerRule(p); } catch { valid = false; }
  const levels: number[] = [];
  if (rule.enabled && valid) { for (let n = parsed.start; n < parsed.cap; n += parsed.interval) levels.push(n); levels.push(parsed.cap); }
  const percent = (n: number) => `${(n * 100).toLocaleString('en-US', { maximumFractionDigits: 6 })}%`;
  const cells=(q:number)=>{
    const row=pending?undefined:compensationEnabled?compensationRows?.find(row=>Math.abs(row.triggerProbability-q)<1e-12):freeSessionMean===undefined?undefined:{freeWinProbability,sessionMean:freeSessionMean,freeRtp:q*freeSessionMean};
    return <><td>{row?percent(row.freeWinProbability):pending?'应用后计算':'—'}</td><td>{row?`${row.sessionMean.toFixed(6)}×`:'—'}</td><td>{row?percent(row.freeRtp):'—'}</td></>;
  };
  return <section className="config-section streak-strategies"><p className="input-note">只统计付费局是否触发免费。普通中奖但没触发免费仍累积次数；免费内部追加继续使用基础触发率。</p>
    <label className="guarantee-option"><input type="checkbox" checked={rule.enabled} onChange={e => onChange({ ...rule, enabled: e.target.checked })} />启用免费触发回归策略</label>
    <fieldset className="free-trigger-fields" disabled={!rule.enabled}>
      {([['start','连续未触发起始局数','局'],['interval','之后每隔','局'],['step','每次增加','个百分点'],['cap','最高值封顶局数','局']] as const).map(([key,label,unit]) => <label className="field" key={key}><span>{label}</span><span className="input-wrap"><input aria-label={`免费策略：${label}`} type="number" min={unit === '局' ? 1 : 0} max={unit === '局' ? 10000 : 100} step={unit === '局' ? 1 : 'any'} value={rule[key]} onChange={e => onChange({ ...rule, [key]: e.target.value })} /><span>{unit}</span></span></label>)}
    </fieldset>
    <p className="input-note">连续 n 局未触发后，下一付费局使用「基础触发率 + h 个百分点」；之后每多 m 局再加 h，封顶后保持（最高 100%）。触发后次数归零，恢复基础触发率。{compensationEnabled ? '提触发率时，自动降低免费中奖率保持 Free RTP；进入免费时锁定该中奖率，包含整段追加。' : '未启用 RTP 补偿，提升触发率会改变 Free RTP，免费自然中奖率保持配置值。'}计算包含随机局数、保底及追加次数限制；保底使目标无法实现时明确提示。</p>
    {rule.enabled && (valid ? <div className="streak-probability-preview"><h3>免费触发概率档位</h3><p>触发率随输入预览；补偿值点击「应用配置」后更新。</p><div className="streak-preview-scroll"><table><thead><tr><th>开奖前未触发局数</th><th>触发率</th><th>免费中奖率</th><th>整段免费EV</th><th>Free RTP</th></tr></thead><tbody>
      <tr><td>0～{parsed.start - 1} 局（基础档）</td><td>{percent(baseProbability)}</td>{cells(baseProbability)}</tr>
      {levels.map((n,i) => {const q=freeTriggerProbability(p,n,true);return <tr key={n}><td>{n === parsed.cap ? `≥ ${n} 局（封顶）` : levels[i+1] - 1 === n ? `${n} 局` : `${n}～${levels[i+1] - 1} 局`}</td><td>{percent(q)}</td>{cells(q)}</tr>;})}
    </tbody></table></div></div> : <p className="input-note">填写有效局数、间隔及增加百分点后显示概率档位。</p>)}
  </section>;
}
