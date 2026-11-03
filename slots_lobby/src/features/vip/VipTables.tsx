import type { VipLevel } from '../../services/vip-details';
import { betMoney } from '../bet-records/money';
type Column = [keyof VipLevel, string];
function Table({ title, columns, levels, current }: {title: string; columns: Column[]; levels: VipLevel[]; current: number}) {
  return <section className="vip-table-section"><h2>{title}</h2><div className="vip-table-scroll" tabIndex={0} role="region" aria-label={title}><table><thead><tr>{columns.map(([key,label]) => <th key={key} scope="col">{label}</th>)}</tr></thead><tbody>{levels.map(row => <tr key={row.level} className={row.level === current ? 'vip-current-row' : ''}>{columns.map(([key]) => <td key={key}>{key === 'level' ? `VIP${row.level}` : betMoney(row[key])}</td>)}</tr>)}</tbody></table></div></section>;
}
export function VipTables({levels,current}: {levels: VipLevel[];current: number}) {
  return <div className="vip-tables"><Table title="晋级及保级条件" levels={levels} current={current} columns={[[ 'level','VIP等级'],['upgradeRecharge','晋级存款'],['upgradeBet','晋级流水'],['keepRecharge','保级存款'],['keepBet','保级流水']]} /><Table title="VIP福利" levels={levels} current={current} columns={[[ 'level','VIP等级'],['upgradeReward','晋级礼金'],['weeklyReward','周礼金'],['monthlyReward','月礼金'],['birthdayReward','生日礼金']]} /><Table title="周／月礼金领取条件" levels={levels} current={current} columns={[[ 'level','VIP等级'],['weeklyRecharge','周存款'],['weeklyBet','周有效流水'],['monthlyRecharge','月存款'],['monthlyBet','月有效流水']]} /><p className="benefits-note">金额以元展示，流水为有效投注流水；当前等级已高亮。统计时区及实际结算以服务端为准。</p></div>;
}
