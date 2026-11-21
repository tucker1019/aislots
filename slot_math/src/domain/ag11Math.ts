import type {WeightRow, WeightTable} from './model';

export interface Ag11Parameters {
  baseSpinWinProbability: number;
  freeSpinTriggerProbability: number;
  featureSpins: number;
  freeRetriggerSpins: number;
  purchaseCostMultiplier: number;
  purchaseFreeWeights: WeightRow[];
  /** Lua 1026 freeMode=2: the 1.25× bet uses its own ordinary/free tables. */
  bet125: Ag11Bet125Parameters;
}
export interface Ag11Bet125Parameters {
  betMultiplier: number;
  baseSpinWinProbability: number;
  freeSpinTriggerProbability: number;
  baseWeights: WeightRow[];
  freeWeights: WeightRow[];
}
export interface Ag11RtpResult {
  baseMean: number;
  freeSessionMean: number;
  purchaseSessionMean: number;
  baseRtp: number;
  freeRtp: number;
  totalRtp: number;
  totalVariance: number;
  standardDeviation: number;
  purchaseRtp: number;
  purchaseVariance: number;
  bet125BaseMean: number;
  bet125FreeSessionMean: number;
  bet125BaseRtp: number;
  bet125FreeRtp: number;
  bet125Rtp: number;
  bet125Variance: number;
}
export interface Ag11BoardConfig {
  version: 1;
  ruleType: 'ag11_v1';
  columns: 6;
  rows: 5;
  normalWinCount: 8;
  maximumAwardCount: 12;
  triggerSymbolCount: 4;
  initialFreeSpins: 15;
  retriggerScatterCount: 3;
  retriggerSpins: 3;
  symbols: Array<{id: number; name: string; role: 'normal'|'scatter'|'multiplier'; color: string}>;
  normalPayouts: Record<string, Record<string, number>>;
  scatterPayouts: Record<string, number>;
  multiplierWeights: {base: WeightRow[]; free: WeightRow[]};
  generationWeights: {base: WeightRow[]; free: WeightRow[]};
  reels: {base: number[]; free: number[]};
}
export interface Ag11SpinSkeleton {
  triggerSpin: boolean;
  boards: number[][];
  baseMultiplier: number;
  newMultiplier: number;
  cumulativeMultiplier: number;
  retriggerSpins: number;
  payout: number;
}
export interface Ag11FreeSkeleton {
  version: 1;
  format: 'ag11-free-session-v1';
  mode: 'free'|'purchase';
  initialSpins: number;
  spins: Ag11SpinSkeleton[];
  totalPayout: number;
  partial: boolean;
}

const EPS = 1e-8;
function finite(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }
function invariant(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function validateAg11Parameters(value: unknown): asserts value is Ag11Parameters {
  invariant(!!value && typeof value === 'object' && !Array.isArray(value), 'AG11 参数必须是对象。');
  const p = value as Record<string, unknown>;
  invariant(Object.keys(p).every(key => ['baseSpinWinProbability','freeSpinTriggerProbability','featureSpins','freeRetriggerSpins','purchaseCostMultiplier','purchaseFreeWeights','bet125'].includes(key)), 'AG11 参数包含未定义字段。');
  invariant(finite(p.baseSpinWinProbability) && p.baseSpinWinProbability >= 0 && p.baseSpinWinProbability <= 1, 'AG11 普通中奖率必须在 0～1。');
  invariant(finite(p.freeSpinTriggerProbability) && p.freeSpinTriggerProbability >= 0 && p.freeSpinTriggerProbability <= 1, 'AG11 免费触发率必须在 0～1。');
  for (const [key, min, max] of [['featureSpins', 1, 1000], ['freeRetriggerSpins', 1, 100], ['purchaseCostMultiplier', 1, 1_000_000]] as const) {
    invariant(Number.isSafeInteger(p[key]) && (p[key] as number) >= min && (p[key] as number) <= max, `AG11 ${key} 必须是 ${min}～${max} 的整数。`);
  }
  validateAg11Weights(p.purchaseFreeWeights, '购买免费整段结果');
  validateAg11Bet125(p.bet125);
}

export function validateAg11Bet125(value: unknown): asserts value is Ag11Bet125Parameters {
  invariant(!!value && typeof value === 'object' && !Array.isArray(value), 'AG11 1.25 倍投注配置必须是对象。');
  const d = value as Record<string, unknown>;
  invariant(Object.keys(d).every(key => ['betMultiplier','baseSpinWinProbability','freeSpinTriggerProbability','baseWeights','freeWeights'].includes(key)), 'AG11 1.25 倍投注配置包含未定义字段。');
  invariant(finite(d.betMultiplier) && d.betMultiplier > 0, 'AG11 1.25 倍投注倍率必须是正数。');
  invariant(finite(d.baseSpinWinProbability) && d.baseSpinWinProbability >= 0 && d.baseSpinWinProbability <= 1, 'AG11 1.25 倍投注普通中奖率必须在 0～1。');
  invariant(finite(d.freeSpinTriggerProbability) && d.freeSpinTriggerProbability >= 0 && d.freeSpinTriggerProbability <= 1, 'AG11 1.25 倍投注免费触发率必须在 0～1。');
  validateAg11Weights(d.baseWeights, 'AG11 1.25 倍投注普通倍率表');
  validateAg11Weights(d.freeWeights, 'AG11 1.25 倍投注免费倍率表');
  invariant((d.baseWeights as WeightRow[]).every(([multiplier]) => multiplier > 0), 'AG11 1.25 倍投注普通倍率表不能包含 0 倍，空奖由中奖率控制。');
  invariant((d.freeWeights as WeightRow[]).every(([multiplier]) => multiplier > 0), 'AG11 1.25 倍投注免费倍率表不能包含 0 倍。');
}

export function validateAg11Weights(value: unknown, label = 'AG11 权重表'): asserts value is WeightRow[] {
  invariant(Array.isArray(value) && value.length > 0, `${label}不能为空。`);
  let totalWeight = 0;
  for (const row of value) {
    invariant(Array.isArray(row) && row.length === 2 && finite(row[0]) && finite(row[1]) && row[0] >= 0 && row[1] >= 0, `${label}包含无效结果倍率或权重。`);
    totalWeight += row[1];
  }
  invariant(Number.isFinite(totalWeight) && totalWeight > 0, `${label}权重总和必须是有限正数。`);
}

export function validateAg11Board(value: unknown): asserts value is Ag11BoardConfig {
  invariant(!!value && typeof value === 'object' && !Array.isArray(value), 'AG11 board.json 必须是对象。');
  const c = value as Ag11BoardConfig;
  invariant(c.version === 1 && c.ruleType === 'ag11_v1' && c.columns === 6 && c.rows === 5 && c.normalWinCount === 8 && c.maximumAwardCount === 12, 'AG11 固定为 6×5，普通图标 8 个起奖，12 个封顶计奖。');
  invariant(c.triggerSymbolCount === 4 && c.initialFreeSpins === 15 && c.retriggerScatterCount === 3 && c.retriggerSpins === 3, 'AG11 免费触发、初始次数或追加次数与规则不一致。');
  invariant(Array.isArray(c.symbols) && c.symbols.length === 11, 'AG11 必须配置 9 种普通图标、散射和倍率图标。');
  const ids = new Set<number>();
  for (const s of c.symbols) {
    invariant(Number.isSafeInteger(s.id) && s.id >= 1 && s.id <= 11 && !ids.has(s.id), 'AG11 图标编号必须唯一且为 1～11。');
    ids.add(s.id);
    invariant(typeof s.name === 'string' && s.name.trim().length > 0 && ['normal', 'scatter', 'multiplier'].includes(s.role), 'AG11 图标配置无效。');
  }
  invariant(c.symbols.filter(s => s.role === 'normal').length === 9 && c.symbols.filter(s => s.role === 'scatter').length === 1 && c.symbols.filter(s => s.role === 'multiplier').length === 1, 'AG11 图标角色数量无效。');
  invariant(!!c.normalPayouts && typeof c.normalPayouts === 'object' && Object.keys(c.normalPayouts).length === 9, 'AG11 普通图标赔付表缺失。');
  for (let id = 1; id <= 9; id++) {
    const payouts = c.normalPayouts[String(id)];
    invariant(!!payouts && ['8','9','10','11','12'].every(count => finite(payouts[count]) && payouts[count] > 0), `AG11 普通图标 ${id} 赔付档位无效。`);
  }
  invariant(JSON.stringify(c.scatterPayouts) === JSON.stringify({4:3,5:5,6:100}), 'AG11 散射赔付必须为 4 个 3 倍、5 个 5 倍、6 个及以上 100 倍。');
  invariant(!!c.multiplierWeights && Array.isArray(c.multiplierWeights.base) && Array.isArray(c.multiplierWeights.free), 'AG11 普通或免费倍率图标权重缺失。');
  validateAg11Weights(c.multiplierWeights.base, '普通局倍率图标');
  validateAg11Weights(c.multiplierWeights.free, '免费局倍率图标');
  for (const row of [...c.multiplierWeights.base, ...c.multiplierWeights.free]) invariant(Number.isSafeInteger(row[0]) && row[0] >= 2 && row[0] <= 500, 'AG11 倍率图标面值必须为 2～500 的整数。');
  invariant(!!c.generationWeights && Array.isArray(c.generationWeights.base) && Array.isArray(c.generationWeights.free), 'AG11 普通或免费图标生成权重缺失。');
  for (const mode of ['base','free'] as const) { const rows=c.generationWeights[mode]; invariant(rows.length===11 && new Set(rows.map(([id])=>id)).size===11 && rows.every(([id,weight])=>Number.isSafeInteger(id)&&id>=1&&id<=11&&finite(weight)&&weight>=0), `AG11 ${mode==='base'?'普通':'免费'}图标生成权重必须覆盖 1～11 且为非负数。`); invariant(rows.reduce((sum,[,weight])=>sum+weight,0)>0, `AG11 ${mode==='base'?'普通':'免费'}图标生成权重总和必须大于 0。`); }
  invariant(!!c.reels && Array.isArray(c.reels.base) && Array.isArray(c.reels.free) && c.reels.base.length === 1000 && c.reels.free.length === 1000, 'AG11 普通轴与免费轴必须各有 1000 个图标位置。');
  invariant([...c.reels.base, ...c.reels.free].every(id => Number.isSafeInteger(id) && id >= 1 && id <= 11), 'AG11 转轴包含未知图标。');
}

function mean(rows: WeightRow[]): number {
  let totalWeight = 0, weighted = 0;
  for (const [value, weight] of rows) { totalWeight += weight; weighted += value * weight; }
  invariant(totalWeight > 0 && Number.isFinite(weighted), 'AG11 权重表期望值超出数值范围。');
  return weighted / totalWeight;
}
function secondMoment(rows: WeightRow[]): number {
  let totalWeight = 0, weighted = 0;
  for (const [value, weight] of rows) { totalWeight += weight; weighted += value * value * weight; }
  invariant(totalWeight > 0 && Number.isFinite(weighted), 'AG11 权重表二阶矩超出数值范围。');
  return weighted / totalWeight;
}

/** Each free row is a complete feature result, including its trigger board and all free spins. */
export function calculateAg11Rtp(base: WeightTable, free: WeightTable, p: Ag11Parameters): Ag11RtpResult {
  validateAg11Parameters(p);
  invariant(base.totalWeight > 0 && free.totalWeight > 0, 'AG11 普通或免费结果表不能为空。');
  const purchaseSessionMean = mean(p.purchaseFreeWeights);
  const baseRtp = (1 - p.freeSpinTriggerProbability) * p.baseSpinWinProbability * base.mean;
  const freeRtp = p.freeSpinTriggerProbability * free.mean;
  const totalRtp = baseRtp + freeRtp;
  const totalSecondMoment = (1 - p.freeSpinTriggerProbability) * p.baseSpinWinProbability * base.secondMoment + p.freeSpinTriggerProbability * free.secondMoment;
  const purchaseSecondMoment = secondMoment(p.purchaseFreeWeights);
  const purchaseRtp = purchaseSessionMean / p.purchaseCostMultiplier;
  const purchaseVariance = Math.max(0, purchaseSecondMoment / p.purchaseCostMultiplier ** 2 - purchaseRtp ** 2);
  const bet125BaseMean = mean(p.bet125.baseWeights);
  const bet125FreeSessionMean = mean(p.bet125.freeWeights);
  const bet125BaseSecondMoment = secondMoment(p.bet125.baseWeights);
  const bet125FreeSecondMoment = secondMoment(p.bet125.freeWeights);
  const bet125BaseRtp = (1 - p.bet125.freeSpinTriggerProbability) * p.bet125.baseSpinWinProbability * bet125BaseMean / p.bet125.betMultiplier;
  const bet125FreeRtp = p.bet125.freeSpinTriggerProbability * bet125FreeSessionMean / p.bet125.betMultiplier;
  const bet125Rtp = bet125BaseRtp + bet125FreeRtp;
  const bet125SecondMoment = ((1 - p.bet125.freeSpinTriggerProbability) * p.bet125.baseSpinWinProbability * bet125BaseSecondMoment + p.bet125.freeSpinTriggerProbability * bet125FreeSecondMoment) / p.bet125.betMultiplier ** 2;
  return {
    baseMean: base.mean,
    freeSessionMean: free.mean,
    purchaseSessionMean,
    baseRtp,
    freeRtp,
    totalRtp,
    totalVariance: Math.max(0, totalSecondMoment - totalRtp ** 2),
    standardDeviation: Math.sqrt(Math.max(0, totalSecondMoment - totalRtp ** 2)),
    purchaseRtp,
    purchaseVariance,
    bet125BaseMean,
    bet125FreeSessionMean,
    bet125BaseRtp,
    bet125FreeRtp,
    bet125Rtp,
    bet125Variance: Math.max(0, bet125SecondMoment - bet125Rtp ** 2),
  };
}

function whole(value: number, label: string): number {
  invariant(Number.isSafeInteger(value) && value >= 0, `${label} 必须是非负整数。`);
  return value;
}

/** Replays cross-spin free multiplier state; skeleton quantity never affects payout odds. */
export function validateAg11FreeSkeleton(value: unknown, p: Ag11Parameters, expectedTotal?: number): asserts value is Ag11FreeSkeleton {
  validateAg11Parameters(p);
  invariant(!!value && typeof value === 'object' && !Array.isArray(value), 'AG11 免费骨架必须是对象。');
  const s = value as Ag11FreeSkeleton;
  invariant(s.version === 1 && s.format === 'ag11-free-session-v1' && (s.mode === 'free' || s.mode === 'purchase'), 'AG11 免费骨架格式或模式无效。');
  invariant(whole(s.initialSpins, '初始免费局数') === p.featureSpins, 'AG11 初始免费局数与配置不一致。');
  invariant(Array.isArray(s.spins) && s.spins.length >= p.featureSpins + 1 && s.spins.length <= p.featureSpins * 101 + 1, 'AG11 骨架必须包含触发盘面和全部免费局。');
  let cumulative = 0;
  let remaining = p.featureSpins;
  let total = 0;
  for (let i = 0; i < s.spins.length; i++) {
    const spin = s.spins[i];
    invariant(spin.triggerSpin === (i === 0), 'AG11 序列第一局必须是触发盘面，其余局必须是免费局。');
    invariant(Array.isArray(spin.boards) && spin.boards.length > 0 && spin.boards.length <= 100, 'AG11 每局必须包含完整的连消盘面序列。');
    for (const board of spin.boards) invariant(Array.isArray(board) && board.length === 30 && board.every(id => Number.isSafeInteger(id) && id >= 0 && (id <= 11 || id >= 1002 && id <= 1500)), 'AG11 每个连消盘面必须有 30 格合法图标。');
    invariant(finite(spin.baseMultiplier) && spin.baseMultiplier >= 0, 'AG11 连消基础倍率无效。');
    invariant(finite(spin.newMultiplier) && spin.newMultiplier >= 0 && Number.isSafeInteger(spin.newMultiplier), 'AG11 本局新增倍率必须是非负整数。');
    invariant(whole(spin.retriggerSpins, '追加局数') === 0 || spin.retriggerSpins === p.freeRetriggerSpins, 'AG11 每次追加局数与配置不一致。');
    if (spin.triggerSpin) {
      invariant(spin.cumulativeMultiplier === 0, 'AG11 触发盘面的倍率不计入免费累计倍率。');
      const factor = spin.newMultiplier > 0 ? spin.newMultiplier : 1;
      invariant(Math.abs(spin.payout - spin.baseMultiplier * factor) < EPS * Math.max(1, spin.payout), 'AG11 触发盘面的结算倍率不一致。');
    } else {
      cumulative += spin.newMultiplier;
      invariant(Math.abs(spin.cumulativeMultiplier - cumulative) < EPS, 'AG11 免费累计倍率必须逐局只增加本局新倍率。');
      const factor = cumulative > 0 ? cumulative : 1;
      invariant(Math.abs(spin.payout - spin.baseMultiplier * factor) < EPS * Math.max(1, spin.payout), 'AG11 免费局奖金与累计倍率不一致。');
      remaining += spin.retriggerSpins - 1;
      invariant(remaining >= 0, 'AG11 免费骨架的局数超过触发及追加次数。');
    }
    total += spin.payout;
  }
  invariant(remaining === 0, 'AG11 免费骨架没有完成全部免费局。');
  invariant(finite(s.totalPayout) && Math.abs(s.totalPayout - total) < EPS * Math.max(1, total), 'AG11 免费骨架总倍率不一致。');
  if (expectedTotal !== undefined) invariant(Math.abs(total - expectedTotal) < EPS * Math.max(1, expectedTotal), 'AG11 免费骨架与权重表目标结果不一致。');
}
