import { useMemo } from 'react';
import { classifyBasePrizes, type WeightTable } from '../domain/model';
const number = (n: number, digits = 4) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
export function BasePrizeTiers({ table, lineCount }: { table: WeightTable | null; lineCount: number }) {
  const tiers = useMemo(() => table && Number.isSafeInteger(lineCount) && lineCount > 0 ? classifyBasePrizes(table, lineCount) : null, [table, lineCount]);
  return <section className="details-panel"><div className="panel-heading"><h2>普通奖分类</h2><span className="status-pill">已应用配置</span></div>
    <p className="table-footnote">按表内倍率 ÷ 线数划分，区间含下限、不含上限，200×归入最后一档。占比为普通表内抽样概率，尚未乘普通中奖率；此表展示原始区间权重；连续未中奖的运行时第一档补偿见高级配置中的概率档位表。</p>
    {tiers ? <div className="table-scroll"><table><thead><tr><th>实际倍率区间</th><th>记录数</th><th>权重合计</th><th>表内概率</th><th>档内平均倍率</th></tr></thead><tbody>{tiers.map(tier => <tr key={tier.minimum}><td>{tier.label}</td><td>{number(tier.records, 0)}</td><td>{number(tier.weight, 7)}</td><td>{number(tier.probability * 100)}%</td><td>{tier.averageMultiplier === null ? '—' : `${number(tier.averageMultiplier, 8)}×`}</td></tr>)}</tbody></table></div> : <p className="table-footnote">请载入普通局权重表并应用有效线数。</p>}
  </section>;
}
