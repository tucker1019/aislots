import {seededRandom} from './simulation';
import type {WeightRow, WeightTable} from './model';
import {calculateAg11Rtp, validateAg11Parameters, type Ag11Parameters} from './ag11Math';

export type Ag11SimulationMode = 'normal'|'bet125'|'purchase';
function pick(rows: WeightRow[], random: () => number): number {
  const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
  let threshold = random() * total;
  for (const [value, weight] of rows) {
    threshold -= weight;
    if (threshold < 0) return value;
  }
  return rows[rows.length - 1][0];
}

export class Ag11Simulator {
  readonly seed: number;
  readonly mode: Ag11SimulationMode;
  readonly parameters: Ag11Parameters;
  readonly base: WeightTable;
  readonly free: WeightTable;
  private readonly random: () => number;
  count = 0;
  triggers = 0;
  hits = 0;
  basePaid = 0;
  freePaid = 0;
  sumSquares = 0;

  constructor(base: WeightTable, free: WeightTable, parameters: Ag11Parameters, mode: Ag11SimulationMode, seed: number) {
    validateAg11Parameters(parameters);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('AG11 随机种子必须是 uint32。');
    this.base = structuredClone(base);
    this.free = structuredClone(free);
    this.parameters = structuredClone(parameters);
    this.mode = mode;
    this.seed = seed;
    this.random = seededRandom(seed);
  }

  round(): {branch: 'base'|'free'|'purchase'; payout: number} {
    if (this.mode === 'purchase') {
      return {branch: 'purchase', payout: pick(this.parameters.purchaseFreeWeights, this.random)};
    }
    const bet125 = this.parameters.bet125;
    const freeTriggerProbability = this.mode === 'bet125' ? bet125.freeSpinTriggerProbability : this.parameters.freeSpinTriggerProbability;
    const baseWinProbability = this.mode === 'bet125' ? bet125.baseSpinWinProbability : this.parameters.baseSpinWinProbability;
    const baseRows = this.mode === 'bet125' ? bet125.baseWeights : this.base.rows;
    const freeRows = this.mode === 'bet125' ? bet125.freeWeights : this.free.rows;
    if (this.random() < freeTriggerProbability) {
      return {branch: 'free', payout: pick(freeRows, this.random)};
    }
    if (this.random() < baseWinProbability) {
      return {branch: 'base', payout: pick(baseRows, this.random)};
    }
    return {branch: 'base', payout: 0};
  }

  step(): void {
    const result = this.round();
    const divisor = this.mode === 'purchase' ? this.parameters.purchaseCostMultiplier : this.mode === 'bet125' ? this.parameters.bet125.betMultiplier : 1;
    const paid = result.payout / divisor;
    this.count++;
    this.hits += Number(result.payout > 0);
    this.sumSquares += paid * paid;
    if (result.branch === 'free') {
      this.triggers++;
      this.freePaid += paid;
    } else if (result.branch === 'base') {
      this.basePaid += paid;
    } else {
      this.freePaid += paid;
    }
  }

  result() {
    const mean = this.count ? (this.basePaid + this.freePaid) / this.count : 0;
    return {
      seed: this.seed,
      mode: this.mode,
      count: this.count,
      triggers: this.triggers,
      totalRtp: mean,
      baseRtp: (this.mode === 'normal' || this.mode === 'bet125') && this.count ? this.basePaid / this.count : 0,
      freeRtp: (this.mode === 'normal' || this.mode === 'bet125') && this.count ? this.freePaid / this.count : 0,
      purchaseRtp: this.mode === 'purchase' ? mean : 0,
      hitProbability: this.count ? this.hits / this.count : 0,
      standardError: this.count > 1 ? Math.sqrt(Math.max(0, (this.sumSquares - this.count * mean * mean) / (this.count - 1)) / this.count) : 0,
    };
  }
}

export function ag11Theory(base: WeightTable, free: WeightTable, parameters: Ag11Parameters) {
  return calculateAg11Rtp(base, free, parameters);
}
