import { t } from '../../i18n';
import type { VipLevel } from '../../services/vip-details';
import { betMoney } from '../bet-records/money';
type Column = [keyof VipLevel, string];
function Table({ title, columns, levels, current }: {title: string; columns: Column[]; levels: VipLevel[]; current: number}) {
  return <section className="vip-table-section"><h2>{title}</h2><div className="vip-table-scroll" tabIndex={0} role="region" aria-label={title}><table><thead><tr>{columns.map(([key,label]) => <th key={key} scope="col">{label}</th>)}</tr></thead><tbody>{levels.map(row => <tr key={row.level} className={row.level === current ? 'vip-current-row' : ''}>{columns.map(([key]) => <td key={key}>{key === 'level' ? `VIP${row.level}` : betMoney(row[key])}</td>)}</tr>)}</tbody></table></div></section>;
}
export function VipTables({levels,current}: {levels: VipLevel[];current: number}) {
  return <div className="vip-tables"><Table title={t('copy.upgradeAndProtectionRequirements')} levels={levels} current={current} columns={[[ 'level',t('copy.vipLevel')],['upgradeRecharge',t('copy.upgradeDeposits')],['upgradeBet',t('copy.upgradeTurnover')],['keepRecharge',t('copy.protectionDeposits')],['keepBet',t('copy.protectionTurnover')]]} /><Table title={t('copy.vipBenefits')} levels={levels} current={current} columns={[[ 'level',t('copy.vipLevel')],['upgradeReward',t('copy.levelUpGift')],['weeklyReward',t('copy.weeklyGift211')],['monthlyReward',t('copy.monthlyGift212')],['birthdayReward',t('copy.birthdayGift')]]} /><Table title={t('copy.weeklyMonthlyGiftRequirements')} levels={levels} current={current} columns={[[ 'level',t('copy.vipLevel')],['weeklyRecharge',t('copy.weeklyDeposits')],['weeklyBet',t('copy.weeklyEligibleTurnover')],['monthlyRecharge',t('copy.monthlyDeposits')],['monthlyBet',t('copy.monthlyEligibleTurnover')]]} /><p className="benefits-note">{t('copy.amountsAreShownInYuanTurnoverMeans')}</p></div>;
}
