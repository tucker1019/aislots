export type WeightRow = [multiplier: number, weight: number];
export interface WeightTable { rows: WeightRow[]; totalWeight: number; mean: number; secondMoment: number; maximum: number; positiveProbability: number }
export interface StreakRule { enabled: boolean; start: number; probability: number; interval: number; step: number; cap: number }
export interface FreeTriggerRule extends StreakRule { resetProbability?: number }
export interface Parameters { freeTriggerRtpCompensation?: boolean; lossStreakRtpCompensation?: boolean; freeTriggerRule?: FreeTriggerRule; freeRetriggerLimit?: number; lossStreakRule?: StreakRule; winStreakRule?: StreakRule; lineCount: number; baseSpinWinProbability: number; freeSpinWinProbability: number; freeSpinTriggerProbability: number; freeSpinGuaranteedWin?: boolean; freeSpinAwardWeights?: WeightRow[]; /** Compatibility with fixed-count saved inputs. */ freeSpinsPerTrigger?: number }

export function parseWeightTable(text: string): WeightTable {
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('JSON 格式错误，请使用 [[倍率, 权重], …]。'); }
  if (!Array.isArray(value) || !value.length) throw new Error('权重表必须是非空数组。');
  let totalWeight = 0, first = 0, second = 0, maximum = 0, positive = 0;
  const rows: WeightRow[] = [];
  for (let i = 0; i < value.length; i++) {
    const row: unknown = value[i];
    if (!Array.isArray(row) || row.length !== 2 || row.some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) throw new Error(`第 ${i + 1} 行必须包含两个有限的非负数：倍率、权重。`);
    const [multiplier, weight] = row as WeightRow;
    rows.push([multiplier, weight]);
    totalWeight += weight;
    first += multiplier * weight;
    second += multiplier * multiplier * weight;
    if (weight > 0) maximum = Math.max(maximum, multiplier);
    if (multiplier > 0) positive += weight;
  }
  if (!(totalWeight > 0)) throw new Error('权重总和必须大于 0。');
  if (![totalWeight, first, second].every(Number.isFinite)) throw new Error('数值过大，超出计算范围，请缩小倍率或同比缩放权重。');
  return { rows, totalWeight, mean: first / totalWeight, secondMoment: second / totalWeight, maximum, positiveProbability: positive / totalWeight };
}


export interface FreeSpinAwardDistribution { rows: WeightRow[]; totalWeight: number; mean: number; variance: number; secondMoment: number }
export function resolveFreeSpinAwards(p: Pick<Parameters, 'freeSpinAwardWeights' | 'freeSpinsPerTrigger'>): FreeSpinAwardDistribution {
  const rows = p.freeSpinAwardWeights !== undefined ? p.freeSpinAwardWeights : [[p.freeSpinsPerTrigger, 1]];
  if (!Array.isArray(rows) || !rows.length || rows.some(row => !Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'number' || !Number.isSafeInteger(row[0]) || row[0] < 1)) throw new Error('免费局数权重表不能为空，每项局数必须为正整数。');
  let table: WeightTable;
  try { table = parseWeightTable(JSON.stringify(rows)); }
  catch { throw new Error('免费局数的权重必须是有限非负数，且权重总和及加权矩必须为有限正数。'); }
  const variance = table.rows.reduce((sum, [count, weight]) => sum + weight / table.totalWeight * (count - table.mean) ** 2, 0);
  return { rows: table.rows, totalWeight: table.totalWeight, mean: table.mean, variance, secondMoment: table.secondMoment };
}

export const BASE_PRIZE_EDGES = [0, 1, 10, 30, 60, 100, 200];
export function basePrizeTierIndex(raw: number, lineCount: number) {
  const actual = raw / lineCount;
  for (let i = BASE_PRIZE_EDGES.length - 1; i >= 0; i--) if (actual >= BASE_PRIZE_EDGES[i]) return i;
  return 0;
}
export interface BasePrizeProfile { mean: number; second: number; hit: number; multiplierMean: number; firstProbability: number; firstTotalWeight: number | null; tierProbabilities: number[] }
export function createBasePrizePlan(table: WeightTable, lineCount: number) {
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) throw new Error('线数必须是正整数。');
  const tiers = BASE_PRIZE_EDGES.map(() => ({ rows: [] as WeightRow[], weight: 0, mean: 0, second: 0, positive: 0 }));
  for (const row of table.rows) { const tier = tiers[basePrizeTierIndex(row[0], lineCount)]; tier.rows.push(row); tier.weight += row[1]; tier.mean += row[0] / lineCount * row[1]; tier.second += (row[0] / lineCount) ** 2 * row[1]; if (row[0] > 0) tier.positive += row[1]; }
  const originalMean = table.mean / lineCount;
  const originalFirstProbability = tiers[0].weight / table.totalWeight;
  const otherWeight = tiers.slice(1).reduce((s,t) => s+t.weight,0);
  const firstMean = tiers[0].weight ? tiers[0].mean / tiers[0].weight : 0;
  const otherMean = otherWeight ? tiers.slice(1).reduce((s,t) => s+t.mean,0) / otherWeight : 0;
  const cache = new Map<string, BasePrizeProfile>();
  const profile = (probability: number, baseline: number, compensate: boolean) => {
    const key = `${probability}:${baseline}:${compensate}`; const saved = cache.get(key); if (saved) return saved;
    let firstProbability = originalFirstProbability;
    if (compensate && probability > baseline && originalMean > 0) {
      if (!(tiers[0].weight > 0)) throw new Error('连续未中奖 RTP 补偿需要 0～1× 区间存在正权重。');
      const target = baseline * originalMean / probability;
      if (target < firstMean - 1e-12 || (!otherWeight && Math.abs(target - firstMean) > 1e-12)) throw new Error(`连续未中奖中奖率过高，第一档均值为 ${firstMean.toFixed(6)}×，只调整区间总权重无法维持 Base RTP；请降低中奖率。`);
      firstProbability = otherWeight ? Math.max(originalFirstProbability, Math.min(1, (otherMean - target) / (otherMean - firstMean))) : 1;
    }
    const probabilities = tiers.map((t,i) => i === 0 ? firstProbability : otherWeight ? (1-firstProbability)*t.weight/otherWeight : 0);
    let mean=0, second=0, positive=0;
    tiers.forEach((t,i)=>{if(t.weight>0){mean+=probabilities[i]*t.mean/t.weight;second+=probabilities[i]*t.second/t.weight;positive+=probabilities[i]*t.positive/t.weight;}});
    const result = {mean:probability*mean,second:probability*second,hit:probability*positive,multiplierMean:mean,firstProbability,firstTotalWeight:firstProbability===1?null:otherWeight*firstProbability/(1-firstProbability),tierProbabilities:probabilities};
    cache.set(key,result);return result;
  };
  return {tiers,profile};
}
type PaidProfile = (streak: number) => BasePrizeProfile;

/** Streak counts are capped only after probabilities stop changing. */
export function streakProbability(p: Parameters, streak: number): number {
  const rule = streak < 0 ? p.lossStreakRule : p.winStreakRule;
  const count = Math.abs(streak);
  if (!rule?.enabled || count < rule.start) return p.baseSpinWinProbability;
  const increments = Math.floor((Math.min(count, rule.cap) - rule.start) / rule.interval);
  return Math.max(0, Math.min(1, rule.probability + (streak < 0 ? 1 : -1) * increments * rule.step));
}
export function streakCap(p: Parameters, win: boolean): number {
  const rule = win ? p.winStreakRule : p.lossStreakRule;
  return rule?.enabled ? rule.cap : 1;
}
export function validateStreakRules(p: Parameters) {
  for (const [rule, direction] of [[p.lossStreakRule, 1], [p.winStreakRule, -1]] as const) {
    if (!rule?.enabled) continue;
    if (![rule.start, rule.interval, rule.cap].every(x => Number.isSafeInteger(x) && x >= 1 && x <= 10000) || rule.cap < rule.start)
      throw new Error('策略起始局数、间隔和封顶局数必须为 1～10000 的整数，且封顶不得早于起始。');
    if (!Number.isFinite(rule.probability) || rule.probability < 0 || rule.probability > 1 || !Number.isFinite(rule.step) || rule.step < 0 || rule.step > 1)
      throw new Error('策略中奖率及每次调整百分点必须在 0～100 之间。');
    if (direction * (rule.probability - p.baseSpinWinProbability) < -1e-12)
      throw new Error('连续未中奖的起始中奖率不得低于基础值，连续中奖的起始中奖率不得高于基础值。');
  }
}
/** Alternating win/loss runs give stationary occupation, including absorbing tails. */
export function effectiveBaseProbability(p: Parameters, positiveProbability: number | ((streak: number) => number), reward: (streak: number) => number = streak => streakProbability(p, streak)): number {
  validateStreakRules(p);
  if (!p.lossStreakRule?.enabled && !p.winStreakRule?.enabled) return reward(0);
  const positiveAt = (s: number) => typeof positiveProbability === 'number' ? positiveProbability : positiveProbability(s);
  const run = (win: boolean) => {
    const cap = streakCap(p, win);
    let survival = 1, duration = 0, weighted = 0;
    for (let count = 1; count <= cap; count++) {
      const state = win ? count : -count;
      const probability = reward(state);
      const hit = 1 - (1 - streakProbability(p, state) * positiveAt(state)) * (1 - p.freeSpinTriggerProbability);
      const stay = win ? hit : 1 - hit;
      if (count === cap) {
        if (stay === 1 && survival > 0) return { duration, weighted, absorbing: survival, terminal: probability };
        const tail = survival === 0 ? 0 : survival / (1 - stay);
        return { duration: duration + tail, weighted: weighted + tail * probability, absorbing: 0, terminal: probability };
      }
      duration += survival; weighted += survival * probability; survival *= stay;
    }
    throw new Error('策略计算失败。');
  };
  const wins = run(true), losses = run(false);
  if (wins.absorbing || losses.absorbing) {
    const initialHit = 1 - (1 - p.baseSpinWinProbability * positiveAt(0)) * (1 - p.freeSpinTriggerProbability);
    const denominator = wins.absorbing + losses.absorbing - wins.absorbing * losses.absorbing;
    const winMass = wins.absorbing * (1 - (1 - initialHit) * losses.absorbing) / denominator;
    return winMass * wins.terminal + (1 - winMass) * losses.terminal;
  }
  return (wins.weighted + losses.weighted) / (wins.duration + losses.duration);
}

export function freeTriggerProbability(p: Parameters, misses: number, triggered: boolean): number {
  const r = p.freeTriggerRule;
  if (!r?.enabled) return p.freeSpinTriggerProbability;
  if (misses < r.start) return triggered && !p.freeTriggerRtpCompensation ? (r.resetProbability ?? p.freeSpinTriggerProbability) : p.freeSpinTriggerProbability;
  return Math.min(1, r.probability + Math.floor((Math.min(misses, r.cap) - r.start) / r.interval) * r.step);
}
export function validateFreeTriggerRule(p: Parameters) {
  const r = p.freeTriggerRule;
  if (!r?.enabled) return;
  if (![r.start, r.interval, r.cap].every(x => Number.isSafeInteger(x) && x >= 1 && x <= 10000) || r.cap < r.start
    || ![r.probability, r.step, ...(p.freeTriggerRtpCompensation ? [] : [r.resetProbability ?? p.freeSpinTriggerProbability])].every(x => Number.isFinite(x) && x >= 0 && x <= 1)
    || r.probability < Math.max(p.freeSpinTriggerProbability, p.freeTriggerRtpCompensation ? p.freeSpinTriggerProbability : (r.resetProbability ?? p.freeSpinTriggerProbability)) || (!p.freeTriggerRtpCompensation && (r.resetProbability ?? p.freeSpinTriggerProbability) > p.freeSpinTriggerProbability))
    throw new Error('免费策略需填写有效局数与概率：起始提升不得低于基础及重置概率，触发后概率不得高于基础值。');
}
/** Sparse joint chain of ordinary streak, free misses and first-trigger status.
 * Laziness removes periodicity; residual tolerance is checked, never guessed. */
function jointPaidProbabilities(p: Parameters, positive: number, profile: PaidProfile) {
  validateFreeTriggerRule(p);
  if (!p.freeTriggerRule?.enabled) {
    const positiveAt = (s: number) => { const b = streakProbability(p,s); return b > 0 ? profile(s).hit / b : 0; };
    const expect = (reward: (s: number) => number) => effectiveBaseProbability(p,positiveAt,reward);
    const b=expect(s=>streakProbability(p,s)),mean=expect(s=>profile(s).mean),second=expect(s=>profile(s).second),hit=expect(s=>profile(s).hit),q=p.freeSpinTriggerProbability;
    return {b,q,bq:b*q,mean,second,hit,meanQ:mean*q};
  }
  validateStreakRules(p);
  // With a constant ordinary probability, free triggers form renewal cycles.
  // Sum survival probabilities, then close the capped geometric tail exactly.
  if (!p.lossStreakRule?.enabled && !p.winStreakRule?.enabled) {
    let survival = 1, duration = 0;
    for (let misses = 0; misses < p.freeTriggerRule.cap; misses++) {
      duration += survival;
      survival *= 1 - freeTriggerProbability(p, misses, true);
    }
    const tailQ = freeTriggerProbability(p, p.freeTriggerRule.cap, true);
    if (tailQ === 0) return { b: p.baseSpinWinProbability, q: 0, bq: 0, mean:profile(0).mean,second:profile(0).second,hit:profile(0).hit,meanQ:0 };
    duration += survival / tailQ;
    const q = 1 / duration;
    return { b: p.baseSpinWinProbability, q, bq: p.baseSpinWinProbability * q, mean:profile(0).mean,second:profile(0).second,hit:profile(0).hit,meanQ:profile(0).mean*q };
  }
  const regenerative = regenerativePaidProbabilities(p, profile);
  if (regenerative) return regenerative;
  type State = { streak: number; misses: number; triggered: boolean; b: number; q: number; edges: [number, number][] };
  const states: State[] = [], ids = new Map<string, number>();
  const add = (streak: number, misses: number, triggered: boolean) => {
    const key = `${streak}:${misses}:${triggered}`;
    const existing = ids.get(key); if (existing !== undefined) return existing;
    if (states.length >= 20000) throw new Error('普通局和免费策略的联合档位过多，请缩小封顶局数。');
    const id = states.length; ids.set(key, id);
    states.push({ streak, misses, triggered, b: streakProbability(p, streak), q: freeTriggerProbability(p, misses, triggered), edges: [] }); return id;
  };
  add(0, 0, false);
  for (let i = 0; i < states.length; i++) {
    const state = states[i], hit = profile(state.streak).hit;
    const win = Math.min(state.streak > 0 ? state.streak + 1 : 1, streakCap(p, true));
    const loss = -Math.min(state.streak < 0 ? -state.streak + 1 : 1, streakCap(p, false));
    const misses = Math.min(state.misses + 1, p.freeTriggerRule.cap);
    const outcomes = [[win, 0, true, state.q], [win, misses, state.triggered, (1 - state.q) * hit], [loss, misses, state.triggered, (1 - state.q) * (1 - hit)]] as const;
    for (const [streak, count, triggered, mass] of outcomes) if (mass > 0) state.edges.push([add(streak, count, triggered), mass]);
  }
  const aggregate = (mass: Float64Array) => {
    let b = 0, q = 0, bq = 0,mean=0,second=0,hit=0,meanQ=0;
    states.forEach((state, i) => { b += mass[i] * state.b; q += mass[i] * state.q; bq += mass[i] * state.b * state.q; const r=profile(state.streak);mean+=mass[i]*r.mean;second+=mass[i]*r.second;hit+=mass[i]*r.hit;meanQ+=mass[i]*r.mean*state.q; });
    return { b, q, bq,mean,second,hit,meanQ };
  };
  let mass = new Float64Array(states.length); mass[0] = 1;
  const iterations = Math.min(100000, Math.floor(50_000_000 / states.length));
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(states.length);
    for (let i = 0; i < states.length; i++) { next[i] += mass[i] / 2; for (const [to, w] of states[i].edges) next[to] += mass[i] * w / 2; }
    let residual = 0; for (let i = 0; i < states.length; i++) residual += Math.abs(next[i] - mass[i]);
    mass = next;
    if (residual < 1e-13) {
      return aggregate(mass);
    }
  }
  throw new Error('联合策略长期分布尚未收敛，请缩小档位或调整极端概率。');
}

/** Regenerate at each free trigger: the long waiting counter is deterministic
 * within a cycle, so only the ordinary streak needs a stationary distribution. */
function regenerativePaidProbabilities(p: Parameters, profile: PaidProfile) {
  const rule = p.freeTriggerRule!;
  const tailQ = freeTriggerProbability(p, rule.cap, true);
  const lossCap = streakCap(p, false), winCap = streakCap(p, true), size = lossCap + winCap;
  if (size > 64 || tailQ <= 0) return null;
  const streaks = [...Array.from({length:lossCap},(_,i)=>-i-1), ...Array.from({length:winCap},(_,i)=>i+1)];
  const index = (s: number) => s < 0 ? -s - 1 : lossCap + s - 1;
  const b = streaks.map(s => streakProbability(p,s));
  const profiles=streaks.map(profile);
  const wins = streaks.map(s => index(Math.min(s > 0 ? s+1 : 1,winCap)));
  const losses = streaks.map(s => index(-Math.min(s < 0 ? -s+1 : 1,lossCap)));
  // Invert I-(1-q_cap)Aᵀ once, where A is the ordinary-only transition.
  const matrix = Array.from({length:size},(_,i)=>{const row=new Float64Array(2*size);row[i]=row[size+i]=1;return row;});
  for(let i=0;i<size;i++){const hit=profiles[i].hit;matrix[wins[i]][i]-=(1-tailQ)*hit;matrix[losses[i]][i]-=(1-tailQ)*(1-hit);}
  for(let col=0;col<size;col++){
    let pivot=col;for(let r=col+1;r<size;r++)if(Math.abs(matrix[r][col])>Math.abs(matrix[pivot][col]))pivot=r;
    if(Math.abs(matrix[pivot][col])<1e-15)return null;
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
    const scale=matrix[col][col];for(let j=0;j<2*size;j++)matrix[col][j]/=scale;
    for(let r=0;r<size;r++)if(r!==col){const factor=matrix[r][col];for(let j=0;j<2*size;j++)matrix[r][j]-=factor*matrix[col][j];}
  }
  const cycle=(start:Float64Array)=>{
    let current=new Float64Array(start);
    const occupied=new Float64Array(size),nextStart=new Float64Array(size),triggerOccupied=new Float64Array(size);
    for(let age=0;age<rule.cap;age++){
      const q=freeTriggerProbability(p,age,true),next=new Float64Array(size);
      for(let i=0;i<size;i++){
        occupied[i]+=current[i];triggerOccupied[i]+=current[i]*q;nextStart[wins[i]]+=current[i]*q;
        next[wins[i]]+=current[i]*(1-q)*profiles[i].hit;next[losses[i]]+=current[i]*(1-q)*(1-profiles[i].hit);
      }
      current=next;
    }
    for(let i=0;i<size;i++){
      let tail=0;for(let j=0;j<size;j++)tail+=matrix[i][size+j]*current[j];
      occupied[i]+=tail;triggerOccupied[i]+=tail*tailQ;nextStart[wins[i]]+=tail*tailQ;
    }
    return {occupied,triggerOccupied,nextStart};
  };
  let start=new Float64Array(size);start[index(1)]=1;
  const limit=Math.min(10000,Math.floor(30_000_000/(size*(rule.cap+size))));
  for(let iteration=0;iteration<limit;iteration++){
    const result=cycle(start);let residual=0,total=0;
    for(let i=0;i<size;i++){total+=result.nextStart[i];residual+=Math.abs(result.nextStart[i]-start[i]);}
    if(Math.abs(total-1)>1e-9)return null;
    if(residual<1e-13){
      let duration=0,base=0,q=0,bq=0,mean=0,second=0,hit=0,meanQ=0;
      for(let i=0;i<size;i++){duration+=result.occupied[i];base+=result.occupied[i]*b[i];q+=result.triggerOccupied[i];bq+=result.triggerOccupied[i]*b[i];mean+=result.occupied[i]*profiles[i].mean;second+=result.occupied[i]*profiles[i].second;hit+=result.occupied[i]*profiles[i].hit;meanQ+=result.triggerOccupied[i]*profiles[i].mean;}
      return {b:base/duration,q:q/duration,bq:bq/duration,mean:mean/duration,second:second/duration,hit:hit/duration,meanQ:meanQ/duration};
    }
    for(let i=0;i<size;i++)start[i]=(start[i]+result.nextStart[i]/total)/2;
  }
  return null;
}

/** Finite retrigger budget: queue length decreases each spin; a trigger
 * appends N spins and consumes one budget unit. Solve moments by budget. */
function limitedFreeSpinMoments(awards: FreeSpinAwardDistribution, q: number, cap: number) {
  if (!Number.isSafeInteger(cap) || cap < 0 || cap > 100) throw new Error('免费最多追加次数必须为 0～100 的整数。');
  const meanByInitial = new Map<number, number>();
  if (cap === 0 || q === 0) {
    awards.rows.forEach(([n]) => meanByInitial.set(n, n));
    return { mean: awards.mean, variance: awards.variance, meanByInitial };
  }
  const active = awards.rows.filter(([, w]) => w > 0);
  const maxN = active.reduce((max, [n]) => Math.max(max, n), 0);
  if (maxN * (cap + 1) * (cap + 2) / 2 * active.length > 10_000_000) throw new Error('免费局数和追加上限组合过大，请缩小上限或局数权重表以完成精确计算。');
  let means = Float64Array.from({ length: maxN * (cap + 1) + 1 }, (_, r) => r);
  let seconds = Float64Array.from(means, r => r * r);
  for (let budget = 1; budget <= cap; budget++) {
    const size = maxN * (cap - budget + 1) + 1;
    const nextMeans = new Float64Array(size), nextSeconds = new Float64Array(size);
    for (let r = 1; r < size; r++) {
      let followingMean = (1 - q) * nextMeans[r - 1];
      let followingSecond = (1 - q) * nextSeconds[r - 1];
      for (const [n, w] of active) {
        const mass = q * w / awards.totalWeight;
        followingMean += mass * means[r - 1 + n];
        followingSecond += mass * seconds[r - 1 + n];
      }
      nextMeans[r] = 1 + followingMean;
      nextSeconds[r] = 1 + 2 * followingMean + followingSecond;
    }
    means = nextMeans; seconds = nextSeconds;
  }
  let mean = 0, second = 0;
  for (const [n, w] of active) { meanByInitial.set(n, means[n]); mean += w / awards.totalWeight * means[n]; second += w / awards.totalWeight * seconds[n]; }
  return { mean, variance: Math.max(0, second - mean * mean), meanByInitial };
}

export function createFreeSessionPlan(free: WeightTable, p: Parameters) {
  const {freeSpinTriggerProbability:q,lineCount}=p;
  const awards = resolveFreeSpinAwards(p);
  const n = awards.mean;
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) throw new Error('线数必须是正整数。');
  const reproduction = n * q;
  if (p.freeRetriggerLimit === undefined && reproduction >= 1) throw new Error('平均赠送免费局数 × 免费触发概率必须小于 1，否则免费总局数的期望不有限。');
  const gap = 1 - reproduction;
  const limited = p.freeRetriggerLimit === undefined ? null : limitedFreeSpinMoments(awards, q, p.freeRetriggerLimit);
  const freeSessionSpins = limited ? limited.mean : n / gap;
  const offspringVariance = q * awards.variance + q * (1 - q) * n ** 2;
  const freeSessionSpinsVariance = limited ? limited.variance : n * offspringVariance / gap ** 3 + awards.variance / gap ** 2;
  const cache=new Map<number,ReturnType<typeof compute>>();
  function compute(f:number) {
  let freeSpinMean = f * free.mean / lineCount;
  let freeSpinVariance = Math.max(0, f * free.secondMoment / lineCount ** 2 - freeSpinMean ** 2);
  let freeSessionMean = freeSessionSpins * freeSpinMean;
  let freeSessionVariance = freeSessionSpins * freeSpinVariance + freeSessionSpinsVariance * freeSpinMean ** 2;
  // Couple to the natural session: add a positive payout only if the first
  // J natural spins are all zero. J is uniform within the initial award N.
  let freeGuaranteeProbability = 0;
  if (p.freeSpinGuaranteedWin) {
    if (!(free.positiveProbability > 0)) throw new Error('免费保底需要免费权重表中至少有一个正倍率且权重大于 0。');
    const hit = f * free.positiveProbability;
    let zeroPrefixRemainingSpins = 0;
    for (const [count, weight] of awards.rows) {
      if (weight === 0) continue;
      let zeroPrefixProbability: number, weightedIndex: number;
      if (hit === 0) {
        zeroPrefixProbability = 1;
        weightedIndex = (count + 1) / 2;
      } else if (hit === 1) {
        zeroPrefixProbability = 0; weightedIndex = 0;
      } else {
        const t = -Math.log1p(-hit), x = count * t;
        zeroPrefixProbability = (1 - hit) * -Math.expm1(-x) / (count * hit);
        // Stable conditional E[J | first J natural payouts are zero].
        const meanIndex = x < 0.001
          ? (count + 1) / 2 + (1 - count ** 2) * t / 12 + (count ** 4 - 1) * t ** 3 / 720
          : 1 / hit - count / Math.expm1(x);
        weightedIndex = zeroPrefixProbability * meanIndex;
      }
      const mass = weight / awards.totalWeight;
      freeGuaranteeProbability += mass * zeroPrefixProbability;
      // Before J, rewards are zero but their independent retriggers remain.
      zeroPrefixRemainingSpins += mass * (zeroPrefixProbability * (limited ? limited.meanByInitial.get(count)! : count / gap) - weightedIndex);
    }
    const positiveMean = free.mean / free.positiveProbability / lineCount;
    const positiveSecond = free.secondMoment / free.positiveProbability / lineCount ** 2;
    const sessionSecond = freeSessionVariance + freeSessionMean ** 2
      + freeGuaranteeProbability * positiveSecond
      + 2 * positiveMean * freeSpinMean * zeroPrefixRemainingSpins;
    freeSessionMean += freeGuaranteeProbability * positiveMean;
    freeSessionVariance = Math.max(0, sessionSecond - freeSessionMean ** 2);
    freeSpinMean = freeSessionMean / freeSessionSpins;
    freeSpinVariance = Math.max(0, f * free.secondMoment / lineCount ** 2 + freeGuaranteeProbability * positiveSecond / freeSessionSpins - freeSpinMean ** 2);
  }
    return {freeSpinMean,freeSpinVariance,freeSessionMean,freeSessionVariance,freeGuaranteeProbability};
  }
  const moments=(f:number)=>{let result=cache.get(f);if(!result){result=compute(f);cache.set(f,result);}return result;};
  return {awards,n,reproduction,freeSessionSpins,freeSessionSpinsVariance,moments};
}
export interface FreeCompensationRow { triggerProbability:number; freeWinProbability:number; sessionMean:number; sessionVariance:number; guaranteeProbability:number; freeRtp:number }
export function createFreeTriggerCompensationPlan(free:WeightTable,p:Parameters) {
  const session=createFreeSessionPlan(free,p),baseline=session.moments(p.freeSpinWinProbability);
  const target=p.freeSpinTriggerProbability*baseline.freeSessionMean;
  const cache=new Map<number,FreeCompensationRow>();
  const at=(triggerProbability:number)=>{
    const saved=cache.get(triggerProbability);if(saved)return saved;
    let f=p.freeSpinWinProbability;
    if(p.freeTriggerRtpCompensation && p.freeTriggerRule?.enabled && triggerProbability!==p.freeSpinTriggerProbability){
      const desired=triggerProbability>0?target/triggerProbability:0;
      const minimum=session.moments(0).freeSessionMean;
      if(desired<minimum-1e-11*Math.max(1,minimum))throw new Error(`免费触发率 ${(triggerProbability*100).toFixed(4)}% 无法保持 Free RTP：保底使整段免费最低 EV 为 ${minimum.toFixed(6)}×，请降低触发率上限。`);
      if(desired>baseline.freeSessionMean+1e-10)throw new Error('免费触发率低于基础值，无法仅降低免费中奖率保持 Free RTP。');
      if(Math.abs(desired-minimum)<1e-12)f=0;
      else {let low=0,high=p.freeSpinWinProbability;for(let i=0;i<60;i++){const mid=(low+high)/2;if(session.moments(mid).freeSessionMean<desired)low=mid;else high=mid;}f=(low+high)/2;}
    }
    const m=session.moments(f),row={triggerProbability,freeWinProbability:f,sessionMean:m.freeSessionMean,sessionVariance:m.freeSessionVariance,guaranteeProbability:m.freeGuaranteeProbability,freeRtp:triggerProbability*m.freeSessionMean};
    cache.set(triggerProbability,row);return row;
  };
  return {session,baseline,target,at};
}
function freeTriggerOccupation(p:Parameters) {
  const rule=p.freeTriggerRule!;let survival=1,duration=0;
  const weights=new Map<number,number>();
  for(let age=0;age<rule.cap;age++){const q=freeTriggerProbability(p,age,true);weights.set(q,(weights.get(q)??0)+survival);duration+=survival;survival*=1-q;}
  const tail=freeTriggerProbability(p,rule.cap,true);
  if(tail===0)return [{probability:0,occupation:1}];
  const length=survival/tail;weights.set(tail,(weights.get(tail)??0)+length);duration+=length;
  return [...weights].map(([probability,weight])=>({probability,occupation:weight/duration}));
}

export function calculateModel(base: WeightTable, free: WeightTable, p: Parameters) {
  const { baseSpinWinProbability: initialBaseProbability, freeSpinWinProbability: f, freeSpinTriggerProbability: q, lineCount } = p;
  if (![initialBaseProbability, f, q].every(x => Number.isFinite(x) && x >= 0 && x <= 1)) throw new Error('概率必须在 0% 到 100% 之间。');
  const plan=createBasePrizePlan(base,lineCount);
  const profile: PaidProfile = streak => plan.profile(streakProbability(p,streak),initialBaseProbability,!!p.lossStreakRtpCompensation && streak < 0);
  if(p.lossStreakRtpCompensation && p.lossStreakRule?.enabled) profile(-p.lossStreakRule.cap);
  const paid = jointPaidProbabilities(p, base.positiveProbability,profile);
  const b = paid.b, paidQ = paid.q;
  const compensation=createFreeTriggerCompensationPlan(free,p);
  const {awards,n,reproduction,freeSessionSpins,freeSessionSpinsVariance}=compensation.session;
  const baseRtp=paid.mean,baseVariance=Math.max(0,paid.second-baseRtp**2);
  let {freeSpinMean,freeSpinVariance,freeSessionMean,freeSessionVariance,freeGuaranteeProbability}=compensation.baseline;
  let compensatedSecond=0,compensatedWins=0,compensatedSpinSecond=0;
  const freeCompensationRows:FreeCompensationRow[]=[];
  if(p.freeTriggerRtpCompensation && p.freeTriggerRule?.enabled){
    // Validate every configured tier, even if it was never reached in a run.
    compensation.at(p.freeSpinTriggerProbability);
    for(let k=p.freeTriggerRule.start;k<p.freeTriggerRule.cap;k+=p.freeTriggerRule.interval)compensation.at(freeTriggerProbability(p,k,true));
    compensation.at(freeTriggerProbability(p,p.freeTriggerRule.cap,true));
    let weightedGuarantee=0;
    for(const {probability:qState,occupation} of freeTriggerOccupation(p)){
      const row=compensation.at(qState);freeCompensationRows.push(row);
      const mass=occupation*qState;
      compensatedSecond+=mass*(row.sessionVariance+row.sessionMean**2);
      compensatedWins+=mass*(freeSessionSpins*row.freeWinProbability*free.positiveProbability+row.guaranteeProbability);
      compensatedSpinSecond+=mass*(freeSessionSpins*row.freeWinProbability*free.secondMoment/lineCount**2+row.guaranteeProbability*(free.positiveProbability>0?free.secondMoment/free.positiveProbability/lineCount**2:0));
      weightedGuarantee+=mass*row.guaranteeProbability;
    }
    freeSessionMean=paidQ>0?compensation.target/paidQ:0;
    freeSessionVariance=paidQ>0?Math.max(0,compensatedSecond/paidQ-freeSessionMean**2):0;
    freeGuaranteeProbability=paidQ>0?weightedGuarantee/paidQ:0;
    freeSpinMean=freeSessionMean/freeSessionSpins;
    freeSpinVariance=paidQ>0?Math.max(0,compensatedSpinSecond/(paidQ*freeSessionSpins)-freeSpinMean**2):0;
  }
  const freeCompensated=!!p.freeTriggerRtpCompensation && !!p.freeTriggerRule?.enabled;
  const freeRtp = freeCompensated?compensation.target:paidQ * freeSessionMean;
  const freeContributionVariance = paidQ * freeSessionVariance + paidQ * (1 - paidQ) * freeSessionMean ** 2;
  const totalVariance = Math.max(0, baseVariance + freeContributionVariance + (freeCompensated?0:2 * (paid.meanQ - baseRtp * paidQ) * freeSessionMean));
  const basePositiveProbability = paid.hit;
  const freePositiveProbability = freeCompensated ? (paidQ>0?compensatedWins/(paidQ*freeSessionSpins):0) : f * free.positiveProbability + freeGuaranteeProbability / freeSessionSpins;
  const expectedWinningSpinsPerPaidSpin = basePositiveProbability + paidQ * freeSessionSpins * freePositiveProbability;
  const baseAverageWinMultiplier = basePositiveProbability > 0 ? baseRtp / basePositiveProbability : null;
  const freeAverageWinMultiplier = freePositiveProbability > 0 ? freeSpinMean / freePositiveProbability : null;
  const overallAverageWinMultiplier = expectedWinningSpinsPerPaidSpin > 0 ? (baseRtp + freeRtp) / expectedWinningSpinsPerPaidSpin : null;
  const result = { freeCompensationRows, effectiveFreeTriggerProbability: paidQ, effectiveBaseWinProbability: b, baselineTotalRtp: initialBaseProbability * base.mean / lineCount + compensation.target, freeGuaranteeProbability, freeSpinsPerTriggerMean: n, freeSpinsPerTriggerVariance: awards.variance, baseAverageWinMultiplier, freeAverageWinMultiplier, overallAverageWinMultiplier, expectedWinningSpinsPerPaidSpin, baseRtp, freeRtp, totalRtp: baseRtp + freeRtp, baseVariance, freeSpinVariance, freeSpinMean, freeSessionSpins, freeSessionSpinsVariance, freeSessionMean, freeSessionVariance, freeContributionVariance, totalVariance, standardDeviation: Math.sqrt(totalVariance), reproduction, expectedFreeSpinsPerPaidSpin: paidQ * freeSessionSpins, basePositiveProbability, freePositiveProbability };
  if (!Object.values(result).every(value => typeof value !== 'number' || Number.isFinite(value))) throw new Error('计算结果超出数值范围，请调整参数。');
  return result;
}

/** View of payouts relative to total bet. Source weights and file data stay unchanged. */
export function payoutTableForDisplay(table: WeightTable, lineCount: number): WeightTable | null {
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) return null;
  return {
    ...table,
    rows: table.rows.map(([multiplier, weight]) => [multiplier / lineCount, weight]),
    mean: table.mean / lineCount,
    secondMoment: table.secondMoment / lineCount ** 2,
    maximum: table.maximum / lineCount,
  };
}

/** Ordinary prize tiers are in total-bet units, not raw table multipliers. */
export function classifyBasePrizes(table: WeightTable, lineCount: number) {
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) throw new Error('线数必须是正整数。');
  const edges = [0, 1, 10, 30, 60, 100, 200];
  const tiers = edges.map((minimum, i) => ({ minimum, maximum: edges[i + 1] ?? null, label: i === edges.length - 1 ? '≥ 200×' : `${minimum}～${edges[i + 1]}×`, records: 0, weight: 0, probability: 0, averageMultiplier: null as number | null, weightedMultiplier: 0 }));
  for (const [raw, weight] of table.rows) {
    const multiplier = raw / lineCount;
    const tier = tiers.find(tier => multiplier >= tier.minimum && (tier.maximum === null || multiplier < tier.maximum))!;
    tier.records++; tier.weight += weight; tier.weightedMultiplier += multiplier * weight;
  }
  return tiers.map(({ weightedMultiplier, ...tier }) => ({ ...tier, probability: tier.weight / table.totalWeight, averageMultiplier: tier.weight > 0 ? weightedMultiplier / tier.weight : null }));
}

/** AG4: one paid outcome is either ordinary or one complete respin sequence. No free-spin branching. */
export function calculateRespinModel(base:WeightTable,free:WeightTable,p:Pick<Parameters,'lineCount'|'baseSpinWinProbability'|'freeSpinWinProbability'|'freeSpinTriggerProbability'>){
 if(!Number.isSafeInteger(p.lineCount)||p.lineCount<1||[p.baseSpinWinProbability,p.freeSpinWinProbability,p.freeSpinTriggerProbability].some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('线数须为正整数，中奖率和重转触发率须为 0～100%。');
 const b=p.baseSpinWinProbability*base.mean/p.lineCount,r=p.freeSpinWinProbability*free.mean/p.lineCount,t=p.freeSpinTriggerProbability;
 const baseRtp=(1-t)*b,freeRtp=t*r,totalRtp=baseRtp+freeRtp;
 const second=((1-t)*p.baseSpinWinProbability*base.secondMoment+t*p.freeSpinWinProbability*free.secondMoment)/(p.lineCount*p.lineCount),totalVariance=Math.max(0,second-totalRtp*totalRtp);
 return {baseRtp,freeRtp,totalRtp,totalVariance,standardDeviation:Math.sqrt(totalVariance),baseMean:base.mean/p.lineCount,respinMean:free.mean/p.lineCount,baseModeRtp:b,respinModeRtp:r,hitProbability:(1-t)*p.baseSpinWinProbability*base.positiveProbability+t*p.freeSpinWinProbability*free.positiveProbability};
}
