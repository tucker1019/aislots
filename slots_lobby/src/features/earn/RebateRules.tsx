import { t } from '../../i18n';
import type { RebateInfo } from '../../services/rebate';
import { betMoney } from '../bet-records/money';
export function RebateRules({info}:{info:RebateInfo}){
 const forecasts=[{label:t('copy.totalEstimatedRebate'),amount:info.daily.reward+info.weekly.reward+info.monthly.reward},{label:t('copy.availableTomorrow'),amount:info.daily.reward},{label:t('copy.availableNextMonday'),amount:info.weekly.reward},{label:t('copy.availableOnThe1StOfNextMonth'),amount:info.monthly.reward}];
 return <div className="rebate-rules-page">
  <div className="rebate-preview rebate-rules-summary">{forecasts.map(row=><div key={row.label}><span>{row.label}</span><strong>{betMoney(row.amount)}</strong></div>)}</div>
  <p className="rebate-rules-callout">{t('copy.rebatesSettleDailyWeeklyAndMonthlyClaim')}</p>
  <div className="rebate-table-wrap"><table className="rebate-rate-table"><caption>{t('copy.providerRebateRates')}</caption><thead><tr>{[t('copy.provider'),t('copy.rebateRate'),t('copy.dailyRebate'),t('copy.weeklyRebate'),t('copy.monthlyRebate')].map(title=><th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>
   {info.platforms.map(p=><tr key={p.name}><th scope="row">{p.name}</th><td>{(p.dailyRateBps+p.weeklyRateBps+p.monthlyRateBps)/100}%</td><td>{p.dailyRateBps/100}%</td><td>{p.weeklyRateBps/100}%</td><td>{p.monthlyRateBps/100}%</td></tr>)}
   {!info.platforms.length&&<tr><td colSpan={5}>{t('copy.noProvidersAvailable')}</td></tr>}
  </tbody></table></div>
  <section className="rebate-rule-description"><h2>{t('copy.rules')}</h2><ol>
   <li>{t('copy.rebatesAreBasedOnEligibleBetsThe')}</li>
   <li>{t('copy.dailyRebatesCoverYesterdayAndCanBe')}</li>
   <li>{t('copy.activityTimezone')} {info.timezone}{t('copy.serverDatesAndPeriodBoundariesApplyUnclaimed')}</li>
   <li>{t('copy.selectClaimOnTheEarnPageTo')}</li>
   <li>{t('copy.estimatesChangeWithEligibleTurnoverAndCannot')}</li>
   <li>{t('copy.theDisplayedRateIsTheSumOf')}</li>
  </ol></section>
 </div>;
}
