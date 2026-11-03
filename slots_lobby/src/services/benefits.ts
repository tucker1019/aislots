import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
export interface CheckinOverview { claimed: boolean; canClaim: boolean; day: number; reward: number }
export interface VipOverview { level: number; upgradeReward: number; weeklyReward: number; monthlyReward: number; upgradeBet: number; upgradeRecharge: number; nextBet: number | null; nextRecharge: number | null; protecting: boolean }
function amount(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('福利数据格式有误');
  return Number(value);
}
export function parseCheckin(data: unknown): CheckinOverview {
  if (!isRecord(data) || !isRecord(data.current) || typeof data.claimed !== 'boolean' || typeof data.canClaim !== 'boolean') throw new Error('签到数据格式有误');
  return { claimed: data.claimed, canClaim: data.canClaim, day: amount(data.currentDay), reward: amount(data.current.reward) };
}
export function parseVip(data: unknown): VipOverview {
  if (!isRecord(data) || !isRecord(data.state) || !Array.isArray(data.levels) || !isRecord(data.weeklyPreview) || !isRecord(data.monthlyPreview)) throw new Error('VIP数据格式有误');
  const level = amount(data.state.level);
  const next: unknown = data.levels.find((row: unknown) => isRecord(row) && row.level === level + 1);
  return { level, upgradeReward: amount(data.upgradeClaimableTotal), weeklyReward: amount(data.weeklyPreview.amount), monthlyReward: amount(data.monthlyPreview.amount), upgradeBet: amount(data.state.upgradeBet), upgradeRecharge: amount(data.state.upgradeRecharge), nextBet: isRecord(next) ? amount(next.upgradeBet) : null, nextRecharge: isRecord(next) ? amount(next.upgradeRecharge) : null, protecting: data.state.status === 'protecting' };
}
async function load(path: string, signal?: AbortSignal) {
  const identity = await ensureSession();
  const params = new URLSearchParams({ uid: String(identity.uid), sid: identity.sid });
  return request(path + '?' + params, { signal }, '福利信息暂时无法加载，请重试');
}
export async function loadCheckinOverview(signal?: AbortSignal) { return parseCheckin(await load('/api/activity/checkin/info', signal)); }
export async function loadVipOverview(signal?: AbortSignal) { return parseVip(await load('/api/vip/info', signal)); }
