import { calculateModel, createBasePrizePlan, createFreeTriggerCompensationPlan, parseWeightTable, resolveFreeSpinAwards, streakProbability, freeTriggerProbability, type Parameters, type WeightRow, type WeightTable } from './model';

export interface SimulationRequest { baseRows: WeightRow[]; freeRows: WeightRow[]; parameters: Parameters; paidSpins: number; seed: number }
export interface SimulationStats {
  basePrizeTierCounts: Record<string, number>;
  freeWaitCounts: Record<string, number>; freeWaitTotal: number; maximumFreeWait: number; currentFreeWait: number;

  maximumWinningStreak: number; maximumLosingStreak: number; freeTriggerStageCounts: Record<string, number>; strategyStageCounts: Record<string, number>;
  completedPaidSpins: number; freeSpins: number; freeTriggers: number; baseWins: number; freeWins: number;
  freeAwardCounts: Record<string, number>; initialFreeAwardCounts: Record<string, number>; retriggerFreeAwardCounts: Record<string, number>;
  basePayout: number; freePayout: number; mean: number; m2: number; maximumSessionPayout: number; maximumBasePayout: number; maximumFreeSessionPayout: number;
}
export interface SimulationProgress { stats: SimulationStats; elapsedMs: number; done: boolean }
export type SimulationMessage = { type: 'progress'; progress: SimulationProgress } | { type: 'error'; message: string };

/** Deterministic 32-bit generator for repeatable numerical experiments. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** O(n) preparation, O(1) weighted sampling; payouts already use total-bet units. */
export function createAliasSampler(rows: WeightRow[], totalWeight: number, lineCount: number) {
  const size = rows.length;
  const probabilities = new Float64Array(size);
  const aliases = new Uint32Array(size);
  const payouts = new Float64Array(size);
  const small: number[] = [], large: number[] = [];
  rows.forEach(([multiplier, weight], i) => {
    probabilities[i] = weight / totalWeight * size;
    payouts[i] = multiplier / lineCount;
    (probabilities[i] < 1 ? small : large).push(i);
  });
  while (small.length && large.length) {
    const low = small.pop()!, high = large.pop()!;
    aliases[low] = high;
    probabilities[high] += probabilities[low] - 1;
    (probabilities[high] < 1 ? small : large).push(high);
  }
  for (const i of [...small, ...large]) probabilities[i] = 1;
  return (random: () => number) => {
    const value = random() * size;
    const column = Math.floor(value);
    return payouts[value - column < probabilities[column] ? column : aliases[column]];
  };
}

/** Two draws: interval probability, then unchanged weights within that interval. */
export function createTieredBaseSampler(table: WeightTable, lineCount: number) {
  const plan = createBasePrizePlan(table,lineCount);
  const samplers = plan.tiers.map(t => t.weight > 0 ? createAliasSampler(t.rows,t.weight,lineCount) : null);
  const selectors = new Map<string, (random:()=>number)=>number>();
  return (random:()=>number, probability: number, baseline: number, compensate:boolean) => {
    const profile=plan.profile(probability,baseline,compensate);
    const key=profile.tierProbabilities.join(',');let select=selectors.get(key);
    if(!select){const active=profile.tierProbabilities.map((weight,index)=>[index,weight] as WeightRow).filter(([,w])=>w>0);select=active.length===1?()=>active[0][0]:createAliasSampler(active,active.reduce((sum,[,w])=>sum+w,0),1);selectors.set(key,select);}
    const tier=select(random);return {tier,payout:samplers[tier]!(random)};
  };
}

/** Count the tier used before the paid spin, not the tier reached by its result. */
export function strategyStageKey(p: Parameters, streak: number): string {
  const rule = streak < 0 ? p.lossStreakRule : p.winStreakRule;
  const count = Math.abs(streak);
  if (!rule?.enabled || count < rule.start) return 'base';
  const threshold = count >= rule.cap ? rule.cap : rule.start + Math.floor((count - rule.start) / rule.interval) * rule.interval;
  return `${streak < 0 ? 'loss' : 'win'}:${threshold}`;
}
export function simulationStrategyStages(p: Parameters) {
  const stages = [{ key: 'base', label: '基础中奖率', range: '未达到启用策略的起始条件', probability: p.baseSpinWinProbability }];
  for (const [kind, rule, sign, label] of [['loss', p.lossStreakRule, -1, '连续未中奖'], ['win', p.winStreakRule, 1, '连续中奖']] as const) {
    if (!rule?.enabled) continue;
    const thresholds: number[] = [];
    for (let k = rule.start; k < rule.cap; k += rule.interval) thresholds.push(k);
    thresholds.push(rule.cap);
    thresholds.forEach((k, index) => stages.push({ key: `${kind}:${k}`, label: `${label} ${k} 局${k === rule.cap ? '（封顶）' : ''}`, range: k === rule.cap ? `≥ ${k} 局` : `${k}～${thresholds[index + 1] - 1} 局`, probability: streakProbability(p, sign * k) }));
  }
  return stages;
}

export function freeTriggerStageKey(p: Parameters, misses: number, triggered: boolean): string {
  const r = p.freeTriggerRule;
  if (!r?.enabled) return 'base';
  if (misses < r.start) return triggered && !p.freeTriggerRtpCompensation ? 'reset' : 'base';
  return `miss:${misses >= r.cap ? r.cap : r.start + Math.floor((misses - r.start) / r.interval) * r.interval}`;
}
export function simulationFreeTriggerStages(p: Parameters) {
  const stages = [{ key: 'base', label: p.freeTriggerRtpCompensation ? '基础档 / 触发后重计' : '首次免费前 / 基础档', probability: p.freeSpinTriggerProbability }];
  const r = p.freeTriggerRule; if (!r?.enabled) return stages;
  if(!p.freeTriggerRtpCompensation) stages.push({ key: 'reset', label: `触发后重计 0～${r.start - 1} 局`, probability: r.resetProbability ?? p.freeSpinTriggerProbability });
  const levels: number[] = []; for (let n = r.start; n < r.cap; n += r.interval) levels.push(n); levels.push(r.cap);
  levels.forEach((n,i) => stages.push({key:`miss:${n}`, label:n === r.cap ? `未触发 ≥ ${n} 局（封顶）` : `未触发 ${n}～${levels[i+1] - 1} 局`, probability:freeTriggerProbability(p,n,true)}));
  return stages;
}

export class Simulator {
  readonly stats: SimulationStats = { basePrizeTierCounts: {}, freeWaitCounts: {}, freeWaitTotal: 0, maximumFreeWait: 0, currentFreeWait: 0, maximumWinningStreak: 0, maximumLosingStreak: 0, freeTriggerStageCounts: {}, strategyStageCounts: {}, completedPaidSpins: 0, freeSpins: 0, freeTriggers: 0, freeAwardCounts: {}, initialFreeAwardCounts: {}, retriggerFreeAwardCounts: {}, baseWins: 0, freeWins: 0, basePayout: 0, freePayout: 0, mean: 0, m2: 0, maximumSessionPayout: 0, maximumBasePayout: 0, maximumFreeSessionPayout: 0 };
  private random: () => number;
  private freeCompensation: ReturnType<typeof createFreeTriggerCompensationPlan>;
  private sessionFreeWinProbability = 0;
  private sampleBase: ReturnType<typeof createTieredBaseSampler>;
  private pendingBaseTier: number | null = null;
  private sampleFree: (random: () => number) => number;
  private sampleGuaranteedFree?: (random: () => number) => number;
  private sampleAward: (random: () => number) => number;
  private pendingAwardCounts: Record<string, number> | null = null;
  private pendingInitialAward = 0;
  private active = false;
  private streak = 0;
  private freeMisses = 0;
  private hasTriggeredFree = false;
  private pendingStrategyStage = 'base';
  private pendingFreeTriggerStage = 'base';
  private remainingFree = 0;
  private guaranteedFreeSpin = 0;
  private pendingBase = 0;
  private pendingFree = 0;
  private pendingFreeSpins = 0;
  private pendingFreeWins = 0;
  private pendingTrigger = 0;
  private pendingRetriggers = 0;

  constructor(readonly request: SimulationRequest, random?: () => number) {
    const base = parseWeightTable(JSON.stringify(request.baseRows));
    const free = parseWeightTable(JSON.stringify(request.freeRows));
    calculateModel(base, free, request.parameters);
    this.freeCompensation=createFreeTriggerCompensationPlan(free,request.parameters);
    const awards = resolveFreeSpinAwards(request.parameters);
    const activeAwards = awards.rows.filter(([, weight]) => weight > 0);
    this.sampleAward = activeAwards.length === 1 ? () => activeAwards[0][0] : createAliasSampler(awards.rows, awards.totalWeight, 1);
    if (!Number.isSafeInteger(request.paidSpins) || request.paidSpins < 1 || request.paidSpins > 1_000_000_000) throw new Error('付费局数必须是 1 到 10 亿之间的整数。');
    if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) throw new Error('种子必须是 0 到 4294967295 之间的整数。');
    this.random = random ?? seededRandom(request.seed);
    this.sampleBase = createTieredBaseSampler(base, request.parameters.lineCount);
    if (request.parameters.freeSpinGuaranteedWin) {
      const positiveRows = free.rows.filter(([multiplier, weight]) => multiplier > 0 && weight > 0);
      this.sampleGuaranteedFree = createAliasSampler(positiveRows, positiveRows.reduce((sum, [, weight]) => sum + weight, 0), request.parameters.lineCount);
    }
    this.sampleFree = createAliasSampler(free.rows, free.totalWeight, request.parameters.lineCount);
  }
  get done() { return this.stats.completedPaidSpins === this.request.paidSpins; }

  /** Budget counts individual rotations, so a long free session never blocks cancellation. */
  step(budget = 10_000): void {
    if (!Number.isSafeInteger(budget) || budget < 1) throw new Error('模拟步长必须为正整数。');
    const p = this.request.parameters;
    for (let i = 0; i < budget && !this.done; i++) {
      if (!this.active) {
        this.pendingFreeTriggerStage = freeTriggerStageKey(p, this.freeMisses, this.hasTriggeredFree);
        this.pendingStrategyStage = strategyStageKey(p, this.streak);
        const probability = streakProbability(p, this.streak);
        const award = this.random() < probability ? this.sampleBase(this.random,probability,p.baseSpinWinProbability,!!p.lossStreakRtpCompensation && this.streak < 0) : null;
        this.pendingBase = award?.payout ?? 0;
        this.pendingBaseTier = award?.tier ?? null;
        this.pendingRetriggers = 0;
        this.pendingFree = 0; this.pendingFreeSpins = 0; this.pendingFreeWins = 0;
        const triggerProbability=freeTriggerProbability(p,this.freeMisses,this.hasTriggeredFree);
        this.pendingTrigger = this.random() < triggerProbability ? 1 : 0;
        this.sessionFreeWinProbability=this.pendingTrigger ? this.freeCompensation.at(triggerProbability).freeWinProbability : p.freeSpinWinProbability;
        this.pendingAwardCounts = null;
        this.pendingInitialAward = this.pendingTrigger ? this.drawAward() : 0;
        this.remainingFree = this.pendingInitialAward;
        this.guaranteedFreeSpin = this.pendingTrigger && p.freeSpinGuaranteedWin ? 1 + Math.floor(this.random() * this.pendingInitialAward) : 0;
        this.active = true;
      } else {
        this.remainingFree--;
        this.pendingFreeSpins++;
        let payout = this.random() < this.sessionFreeWinProbability ? this.sampleFree(this.random) : 0;
        if (this.random() < p.freeSpinTriggerProbability && (p.freeRetriggerLimit === undefined || this.pendingRetriggers < p.freeRetriggerLimit)) { this.remainingFree += this.drawAward(); this.pendingRetriggers++; }
        if (this.pendingFreeSpins === this.guaranteedFreeSpin && this.pendingFreeWins === 0 && payout === 0 && this.sampleGuaranteedFree) payout = this.sampleGuaranteedFree(this.random);
        this.pendingFree += payout;
        if (payout > 0) this.pendingFreeWins++;
      }
      if (this.remainingFree === 0) this.commitSession();
    }
    if (![this.remainingFree, this.pendingFreeSpins, this.stats.freeSpins].every(Number.isSafeInteger) || !Number.isFinite(this.pendingFree)) throw new Error('模拟累计值超出数值范围，请调整参数。');
  }
  private drawAward() {
    const count = this.sampleAward(this.random);
    this.pendingAwardCounts ??= {};
    this.pendingAwardCounts[count] = (this.pendingAwardCounts[count] ?? 0) + 1;
    return count;
  }
  private commitSession() {
    const s = this.stats;
    const payout = this.pendingBase + this.pendingFree;
    s.freeTriggerStageCounts[this.pendingFreeTriggerStage] = (s.freeTriggerStageCounts[this.pendingFreeTriggerStage] ?? 0) + 1;
    const wait = s.currentFreeWait + 1;
    if (this.pendingTrigger) {
      s.freeWaitCounts[wait] = (s.freeWaitCounts[wait] ?? 0) + 1;
      s.freeWaitTotal += wait;
      s.maximumFreeWait = Math.max(s.maximumFreeWait, wait);
      s.currentFreeWait = 0;
    } else s.currentFreeWait = wait;
    if (this.pendingTrigger) { this.freeMisses = 0; this.hasTriggeredFree = true; }
    else this.freeMisses = Math.min(this.freeMisses + 1, this.request.parameters.freeTriggerRule?.enabled ? this.request.parameters.freeTriggerRule.cap : 1);
    const win = this.pendingBase > 0 || this.pendingTrigger > 0;
    this.streak = win ? (this.streak > 0 ? this.streak + 1 : 1) : (this.streak < 0 ? this.streak - 1 : -1);
    s.maximumWinningStreak = Math.max(s.maximumWinningStreak, this.streak);
    s.maximumLosingStreak = Math.max(s.maximumLosingStreak, -this.streak);
    s.strategyStageCounts[this.pendingStrategyStage] = (s.strategyStageCounts[this.pendingStrategyStage] ?? 0) + 1;
    s.completedPaidSpins++;
    if(this.pendingBaseTier !== null) s.basePrizeTierCounts[this.pendingBaseTier]=(s.basePrizeTierCounts[this.pendingBaseTier]??0)+1;
    s.basePayout += this.pendingBase; s.freePayout += this.pendingFree;
    s.freeSpins += this.pendingFreeSpins; s.freeTriggers += this.pendingTrigger;
    if (this.pendingBase > 0) s.baseWins++;
    s.freeWins += this.pendingFreeWins;
    if (this.pendingAwardCounts) {
      for (const [count, frequency] of Object.entries(this.pendingAwardCounts)) {
        s.freeAwardCounts[count] = (s.freeAwardCounts[count] ?? 0) + frequency;
        const initial = Number(count) === this.pendingInitialAward ? 1 : 0;
        if (initial) s.initialFreeAwardCounts[count] = (s.initialFreeAwardCounts[count] ?? 0) + 1;
        if (frequency > initial) s.retriggerFreeAwardCounts[count] = (s.retriggerFreeAwardCounts[count] ?? 0) + frequency - initial;
      }
    }
    const delta = payout - s.mean;
    s.mean += delta / s.completedPaidSpins;
    s.m2 += delta * (payout - s.mean);
    s.maximumSessionPayout = Math.max(s.maximumSessionPayout, payout);
    s.maximumBasePayout = Math.max(s.maximumBasePayout, this.pendingBase);
    s.maximumFreeSessionPayout = Math.max(s.maximumFreeSessionPayout, this.pendingFree);
    this.active = false;
    if (![s.mean, s.m2, s.basePayout, s.freePayout].every(Number.isFinite)) throw new Error('模拟奖金超出数值范围，请调整参数。');
  }
}

export function summarizeSimulation(s: SimulationStats) {
  const count = s.completedPaidSpins;
  const wins = s.baseWins + s.freeWins;
  const waits = Object.entries(s.freeWaitCounts ?? {}).map(([wait, frequency]) => [Number(wait), frequency] as const).sort((a,b) => a[0] - b[0]);
  let cumulative = 0, freeWaitP95: number | null = null;
  const rank = Math.ceil(s.freeTriggers * 0.95);
  for (const [wait, frequency] of waits) { cumulative += frequency; if (cumulative >= rank) { freeWaitP95 = wait; break; } }
  const variance = count > 1 ? Math.max(0, s.m2 / (count - 1)) : null;
  return {
    averageFreeWait: s.freeTriggers ? s.freeWaitTotal / s.freeTriggers : null,
    freeWaitP95,
    maximumCompletedFreeWait: s.freeTriggers ? s.maximumFreeWait : null,
    observedLongestFreeWait: count ? Math.max(s.maximumFreeWait, s.currentFreeWait) : null,
    incompleteFreeWait: s.currentFreeWait,
    effectiveFreeTriggerProbability: count ? s.freeTriggers / count : null,
    totalRtp: count ? (s.basePayout + s.freePayout) / count : null,
    baseRtp: count ? s.basePayout / count : null,
    freeRtp: count ? s.freePayout / count : null,
    totalVariance: variance,
    standardDeviation: variance === null ? null : Math.sqrt(variance),
    baseAverageWinMultiplier: s.baseWins ? s.basePayout / s.baseWins : null,
    freeAverageWinMultiplier: s.freeWins ? s.freePayout / s.freeWins : null,
    overallAverageWinMultiplier: wins ? (s.basePayout + s.freePayout) / wins : null,
    basePositiveProbability: count ? s.baseWins / count : null,
    freePositiveProbability: s.freeSpins ? s.freeWins / s.freeSpins : null,
    freeSessionSpins: s.freeTriggers ? s.freeSpins / s.freeTriggers : null,
    expectedFreeSpinsPerPaidSpin: count ? s.freeSpins / count : null,
  };
}
