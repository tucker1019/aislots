import { t } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export interface CheckinDay { day: number; reward: number; requiredBet: number; requiredRecharge: number }
export interface CheckinInfo { activityDate: string; currentDay: number; claimed: boolean; canClaim: boolean; validBet: number; rechargeAmount: number; days: CheckinDay[]; current: CheckinDay }
function money(value: unknown): number {
 if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(t('copy.invalidCheckInResponse'));
 return Number(value);
}
function day(value: unknown): CheckinDay {
 if (!isRecord(value)) throw new Error(t('copy.invalidCheckInResponse'));
 const n = money(value.day); if (n < 1) throw new Error(t('copy.invalidCheckInDay'));
 return { day: n, reward: money(value.reward), requiredBet: money(value.requiredBet), requiredRecharge: money(value.requiredRecharge) };
}
export function parseCheckinInfo(data: unknown): CheckinInfo {
 if (!isRecord(data) || typeof data.activityDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.activityDate) || typeof data.claimed !== 'boolean' || typeof data.canClaim !== 'boolean' || !Array.isArray(data.days) || !data.days.length || data.days.length > 366) throw new Error(t('copy.invalidCheckInResponse'));
 const days = data.days.map(day); const current = day(data.current); const currentDay = money(data.currentDay);
 if (currentDay !== current.day || currentDay > days.length || days.some((row, i) => row.day !== i + 1)) throw new Error(t('copy.invalidCheckInDay'));
 return {activityDate:data.activityDate,currentDay,claimed:data.claimed,canClaim:data.canClaim,validBet:money(data.validBet),rechargeAmount:money(data.rechargeAmount),days,current};
}
export async function loadCheckinInfo(signal?: AbortSignal): Promise<CheckinInfo> {
 const session = await ensureSession();
 return parseCheckinInfo(await request('/api/activity/checkin/info?' + new URLSearchParams({uid:String(session.uid),sid:session.sid}),{signal},t('copy.checkInInformationFailedToLoadPlease')));
}
export async function claimCheckin(activityDate: string): Promise<number> {
 const session = await ensureSession();
 const data = await request('/api/activity/checkin/claim',{method:'POST',body:JSON.stringify({uid:session.uid,sid:session.sid,activityDate})},t('copy.checkInIncompletePleaseRetryIfThe'));
 if (!isRecord(data) || data.activityDate !== activityDate || typeof data.claimId !== 'string') throw new Error(t('copy.invalidCheckInResultPleaseRetryTo'));
 return money(data.reward);
}
