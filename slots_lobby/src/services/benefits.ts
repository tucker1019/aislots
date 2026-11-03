import { t } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export interface CheckinOverview { claimed: boolean; canClaim: boolean; day: number; reward: number }
export interface SalaryPeriod { amount:number; status:string; actualBet:number; actualRecharge:number; requiredBet:number; requiredRecharge:number; availableAt:string; expiresAt:string }
export interface VipOverview { nextUpgradeReward?:number; activityDate?:string; timezone?:string; weekly?:SalaryPeriod; monthly?:SalaryPeriod; weeklyPreview?:SalaryPeriod; monthlyPreview?:SalaryPeriod; level: number; upgradeReward: number; weeklyReward: number; monthlyReward: number; upgradeBet: number; upgradeRecharge: number; nextBet: number | null; nextRecharge: number | null; protecting: boolean }
function amount(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(t('copy.invalidBenefitsData'));
  return Number(value);
}
export function parseCheckin(data: unknown): CheckinOverview {
  if (!isRecord(data) || !isRecord(data.current) || typeof data.claimed !== 'boolean' || typeof data.canClaim !== 'boolean') throw new Error(t('copy.invalidCheckInData'));
  return { claimed: data.claimed, canClaim: data.canClaim, day: amount(data.currentDay), reward: amount(data.current.reward) };
}

function salary(value:unknown):SalaryPeriod|undefined {
 if(value===undefined || (isRecord(value)&&value.status===undefined))return undefined;
 if(!isRecord(value)||typeof value.status!=='string'||typeof value.availableAt!=='string'||typeof value.expiresAt!=='string')throw new Error(t('copy.invalidVipGiftData'));
 return {amount:amount(value.amount),status:value.status,actualBet:amount(value.actualBet),actualRecharge:amount(value.actualRecharge),requiredBet:amount(value.requiredBet),requiredRecharge:amount(value.requiredRecharge),availableAt:value.availableAt,expiresAt:value.expiresAt};
}
export function parseVip(data: unknown): VipOverview {
  if (!isRecord(data) || !isRecord(data.state) || !Array.isArray(data.levels) || !isRecord(data.weeklyPreview) || !isRecord(data.monthlyPreview)) throw new Error(t('copy.invalidVipData'));
  const level = amount(data.state.level);
  const next: unknown = data.levels.find((row: unknown) => isRecord(row) && row.level === level + 1);
  return { nextUpgradeReward:isRecord(next)?amount(next.upgradeReward??0):0,activityDate:typeof data.activityDate==='string'?data.activityDate:undefined,timezone:typeof data.timezone==='string'?data.timezone:undefined,weekly:salary(data.weekly),monthly:salary(data.monthly),weeklyPreview:salary(data.weeklyPreview),monthlyPreview:salary(data.monthlyPreview),level, upgradeReward: amount(data.upgradeClaimableTotal), weeklyReward: amount(data.weeklyPreview.amount), monthlyReward: amount(data.monthlyPreview.amount), upgradeBet: amount(data.state.upgradeBet), upgradeRecharge: amount(data.state.upgradeRecharge), nextBet: isRecord(next) ? amount(next.upgradeBet) : null, nextRecharge: isRecord(next) ? amount(next.upgradeRecharge) : null, protecting: data.state.status === 'protecting' };
}
async function load(path: string, signal?: AbortSignal) {
  const identity = await ensureSession();
  const params = new URLSearchParams({ uid: String(identity.uid), sid: identity.sid });
  return request(path + '?' + params, { signal }, t('copy.benefitsAreUnavailablePleaseRetry'));
}
export async function loadCheckinOverview(signal?: AbortSignal) { return parseCheckin(await load('/api/activity/checkin/info', signal)); }
export async function loadVipOverview(signal?: AbortSignal) { return parseVip(await load('/api/vip/info', signal)); }
