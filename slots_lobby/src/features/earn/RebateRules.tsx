import type { RebateInfo } from '../../services/rebate';
import { betMoney } from '../bet-records/money';
export function RebateRules({info}:{info:RebateInfo}){
 const forecasts=[{label:'总预估反水',amount:info.daily.reward+info.weekly.reward+info.monthly.reward},{label:'明日可领',amount:info.daily.reward},{label:'下周一可领',amount:info.weekly.reward},{label:'下月1号可领',amount:info.monthly.reward}];
 return <div className="rebate-rules-page">
  <div className="rebate-preview rebate-rules-summary">{forecasts.map(row=><div key={row.label}><span>{row.label}</span><strong>{betMoney(row.amount)}</strong></div>)}</div>
  <p className="rebate-rules-callout">反水分日、周、月三个周期结算，请在领取窗口内主动领取。</p>
  <div className="rebate-table-wrap"><table className="rebate-rate-table"><caption>平台反水比例</caption><thead><tr>{['平台','反水比例','日反水','周反水','月反水'].map(title=><th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>
   {info.platforms.map(p=><tr key={p.name}><th scope="row">{p.name}</th><td>{(p.dailyRateBps+p.weeklyRateBps+p.monthlyRateBps)/100}%</td><td>{p.dailyRateBps/100}%</td><td>{p.weeklyRateBps/100}%</td><td>{p.monthlyRateBps/100}%</td></tr>)}
   {!info.platforms.length&&<tr><td colSpan={5}>暂无开放平台</td></tr>}
  </tbody></table></div>
  <section className="rebate-rule-description"><h2>规则说明</h2><ol>
   <li>按有效投注计算反水，同一笔有效投注可同时参与日、周、月三个周期。各周期先汇总有效投注，再按对应比例计算，向下取整到分。</li>
   <li>日反水按昨天的有效投注计算，今天可领取；周反水按上周一至周日计算，本周一当天可领取；月反水按上个自然月计算，本月1号当天可领取。</li>
   <li>活动时区为 {info.timezone}，以服务端日期和周期边界为准。窗口结束后未领取的奖励失效，不累计、不补领。</li>
   <li>在赚钱页点击“领取”，一次领取当天全部可领取的日、周、月反水；本活动不包含亏损返还。</li>
   <li>预估金额随本周期有效投注变化，尚不能领取；最终奖励以服务端结算为准。总预估反水为三个周期预估之和，不是当前可领取金额。</li>
   <li>表中的反水比例是日、周、月比例之和，各周期独立计算和领取。</li>
  </ol></section>
 </div>;
}
