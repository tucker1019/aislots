import { t } from '../../i18n';
export type RecordPeriod = 'today' | 'yesterday' | 'week' | 'month';
export const periodLabels: () => Record<RecordPeriod, string> = () => ({ today: t('copy.today'), yesterday: t('copy.yesterday'), week: t('copy.last7Days'), month: t('copy.last30Days') });
/** 按浏览器本地日期计算，传给服务端的是UTC绝对时间；结束时间不包含在范围内。 */
export function recordRange(period: RecordPeriod, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from); to.setDate(to.getDate() + 1);
  if (period === 'yesterday') { to.setDate(to.getDate() - 1); from.setDate(from.getDate() - 1); }
  else if (period === 'week') from.setDate(from.getDate() - 6);
  else if (period === 'month') from.setDate(from.getDate() - 29);
  return { from: from.toISOString(), to: to.toISOString() };
}
