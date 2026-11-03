import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
const levelFields = ['level','upgradeBet','upgradeRecharge','keepBet','keepRecharge','upgradeReward','weeklyReward','monthlyReward','birthdayReward','weeklyBet','weeklyRecharge','monthlyBet','monthlyRecharge'] as const;
export type VipLevel = Record<typeof levelFields[number], number>;
const stateFields = ['level','highestLevel','upgradeBet','upgradeRecharge','protectionBet','protectionRecharge','protectionRequiredBet','protectionRequiredRecharge'] as const;
export interface VipReward { rewardId: string; level: number; amount: number; status: string }
export interface VipDetails { activityDate: string; upgradeRewards: VipReward[]; weekly: VipReward; monthly: VipReward; levels: VipLevel[]; state: Record<typeof stateFields[number], number> & { status: string; protectionEnd: string }; idleDays: number; protectionDays: number; timezone: string }
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('VIP数据格式有误');
  return value;
}
function fields<K extends string>(value: unknown, names: readonly K[]): Record<K, number> {
  if (!isRecord(value)) throw new Error('VIP数据格式有误');
  return Object.fromEntries(names.map(name => [name, amount(value[name])])) as Record<K, number>;
}
function reward(value: unknown): VipReward {
  if (!isRecord(value) || typeof value.rewardId !== 'string' || !['','claimable','claimed','expired','ineligible','no_reward'].includes(String(value.status))) throw new Error('VIP奖励格式有误');
  return { rewardId: value.rewardId, level: amount(value.level), amount: amount(value.amount), status: String(value.status) };
}
export function parseVipDetails(data: unknown): VipDetails {
  if (!isRecord(data) || !Array.isArray(data.levels) || !isRecord(data.state) || !['normal','protecting'].includes(String(data.state.status)) || typeof data.timezone !== 'string') throw new Error('VIP数据格式有误');
  const levels = data.levels.map(row => fields(row, levelFields)).sort((a,b) => a.level-b.level);
  const state = { ...fields(data.state, stateFields), status: String(data.state.status), protectionEnd: typeof data.state.protectionEnd === 'string' ? data.state.protectionEnd : '' };
  if (!levels.length || new Set(levels.map(row => row.level)).size !== levels.length || !levels.some(row => row.level === state.level)) throw new Error('VIP等级配置有误');
  if (typeof data.activityDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.activityDate) || !Array.isArray(data.upgradeRewards)) throw new Error('VIP奖励格式有误');
  return { activityDate: data.activityDate, upgradeRewards: data.upgradeRewards.map(reward), weekly: reward(data.weekly), monthly: reward(data.monthly), levels, state, idleDays: amount(data.idleDays), protectionDays: amount(data.protectionDays), timezone: data.timezone };
}
export async function loadVipDetails(signal?: AbortSignal): Promise<VipDetails> {
  const identity = await ensureSession();
  const params = new URLSearchParams({ uid: String(identity.uid), sid: identity.sid });
  return parseVipDetails(await request('/api/vip/info?' + params, {signal}, 'VIP详情暂时无法加载，请重试'));
}

export type VipRewardKind = 'upgrade' | 'weekly' | 'monthly';
export async function claimVipReward(kind: VipRewardKind, activityDate: string, requestId: string): Promise<number> {
  const identity = await ensureSession();
  const data = await request(`/api/vip/${kind}/claim`, {method:'POST',body:JSON.stringify({uid:identity.uid,sid:identity.sid,activityDate,requestId})}, '领取未完成，请重试确认');
  if (!isRecord(data) || typeof data.claimId !== 'string' || !data.claimId) throw new Error('领取结果待确认，请重试');
  return amount(data.totalReward);
}
