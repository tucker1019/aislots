import { advanceCascadeRound, createCascadeRound, evaluateWays, symbolDefinitions, validateCascadeConfig, type Board, type BoardMode, type CascadeConfig, type CascadeRound } from './cascade';

export type Skeleton = number[];
export type LibraryBuckets = Record<string, Skeleton[]>;
export interface LibraryOptions { mode: BoardMode; count: number; seed: number; perMultiplier: number }
export interface LibraryStats { completed: number; wins: number; losses: number; limited: number; retained: number; duplicates: number; capacitySkipped: number; bucketCount: number }
export interface LibraryResult { version: 1; options: LibraryOptions; stats: LibraryStats; buckets: LibraryBuckets }
export const LIBRARY_LIMITS = { count: 100_000_000, perMultiplier: 10_000, records: 100_000, buckets: 10_000, bytes: 32 * 1024 * 1024 };

// Keys use exact decimal arithmetic on the configured raw payouts and factors.
function decimal(value: number): [bigint, number] {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return [BigInt(mantissa.replace('.', '')), fraction - Number(exponent)];
}
function sumRaw(wins: Array<{ pay: number; ways: number; factor: number }>): string {
  const terms = wins.map(win => { const [p, ps] = decimal(win.pay), [f, fs] = decimal(win.factor); return {n: p * f * BigInt(win.ways), scale: ps + fs}; });
  const scale = Math.max(0, ...terms.map(t => t.scale));
  const total = terms.reduce((sum, t) => sum + t.n * 10n ** BigInt(scale - t.scale), 0n);
  if (!scale) return String(total);
  const digits = String(total).padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '');
}
function rawWins(round: CascadeRound, config: CascadeConfig) {
  return round.steps.flatMap(step => step.wins.map(win => ({pay: config.symbols.find(s => s.id === win.symbolId)!.payouts[win.columns], ways: win.ways, factor: win.factor})));
}
export function rawMultiplierKey(round: CascadeRound, config: CascadeConfig): string { return sumRaw(rawWins(round, config)); }

export function encodeSkeleton(round: CascadeRound): Skeleton {
  if (!round.finished || round.limited || !round.steps.length || round.totalPayout <= 0) throw new Error('只保存完整结束的中奖消除链。');
  const needed = new Set(round.steps.flatMap(step => step.wins.flatMap(win => win.cellIds)));
  const stage = (board: Board, born?: Set<number>) => {
    const pairs: number[] = [];
    board.flat().forEach((cell, position) => {
      if (!needed.has(cell.id) || (born && !born.has(cell.id))) return;
      const symbol = Number(cell.symbolId);
      if (!Number.isSafeInteger(symbol) || symbol < 1 || String(symbol) !== cell.symbolId) throw new Error('生成盘面库需要正整数图标 ID。');
      pairs.push(position, symbol);
    });
    return [pairs.length / 2, ...pairs];
  };
  return [...stage(round.steps[0].before), ...round.steps.flatMap(step => stage(step.after, new Set(step.refillIds)))];
}

/** Replays only the fixed cells. Hole cells cannot participate in Ways. */
export function inspectSkeleton(data: Skeleton, config: CascadeConfig, mode: BoardMode): { key: string; cascades: number } {
  if (!Array.isArray(data) || data.length < 4 || data.length > 30_000 || !data.every(Number.isSafeInteger)) throw new Error('骨架必须是有效的紧凑整数数组。');
  const definitions = symbolDefinitions(config), hole = '__hole';
  const rules = {...config, lineCount: 1, symbols: [...config.symbols, {id:hole, name:'空位', role:'scatter' as const, weight:0, color:'#000000', payouts:{}}]};
  const fixed = new Set<number>(), used = new Set<number>();
  let offset = 0, nextId = 1;
  let board: Board = config.columnHeights.map(height => Array.from({length:height}, () => ({id:nextId++, symbolId:hole})));
  function apply(fresh: Set<number>) {
    const count = data[offset++];
    if (!Number.isSafeInteger(count) || count < 0 || count > board.flat().length || offset + count * 2 > data.length) throw new Error('骨架阶段长度无效。');
    const positions = new Set<number>();
    const cells = board.flat();
    for (let i=0; i<count; i++) {
      const position = data[offset++], symbolId = String(data[offset++]), symbol = definitions.get(symbolId);
      const cell = cells[position];
      if (!cell || !fresh.has(cell.id) || positions.has(position) || !symbol || symbol.role !== 'normal') throw new Error('骨架位置必须指向本次新格子，且只能固定普通或金底图标。');
      positions.add(position); cell.symbolId = symbolId; fixed.add(cell.id);
    }
    return count;
  }
  if (!apply(new Set(board.flat().map(c=>c.id)))) throw new Error('中奖骨架缺少初始固定图标。');
  const terms: Array<{pay:number;ways:number;factor:number}> = [];
  let cascades = 0;
  while (offset < data.length) {
    const wins = evaluateWays(board, rules, cascades, mode);
    if (!wins.length || cascades >= 100) throw new Error('骨架的消除链提前结束或超过上限。');
    const winning = new Set(wins.flatMap(w=>w.cellIds));
    winning.forEach(id=>used.add(id));
    terms.push(...wins.map(w=>({pay:config.symbols.find(s=>s.id===w.symbolId)!.payouts[w.columns],ways:w.ways,factor:w.factor})));
    const fresh = new Set<number>();
    board = board.map((column,c) => {
      const survivors = column.flatMap(cell => !winning.has(cell.id) ? [cell] : definitions.get(cell.symbolId)?.gold ? [{...cell,symbolId:config.gold.wildSymbolId!}] : []);
      const added = Array.from({length:config.columnHeights[c]-survivors.length}, () => {const cell={id:nextId++,symbolId:hole};fresh.add(cell.id);return cell;});
      return [...added,...survivors];
    });
    const count = apply(fresh); cascades++;
    if (offset === data.length && count !== 0) throw new Error('骨架必须以 0 收尾。');
  }
  if (!cascades || evaluateWays(board,rules,cascades,mode).length) throw new Error('骨架末尾仍有未完成的中奖。');
  if ([...fixed].some(id=>!used.has(id))) throw new Error('骨架包含整局未参与中奖的固定图标。');
  return {key:sumRaw(terms),cascades};
}

export function validateLibraryOptions(options: LibraryOptions): void {
  if (!options || !['base','free'].includes(options.mode) || !Number.isSafeInteger(options.count) || options.count<1 || options.count>LIBRARY_LIMITS.count || !Number.isSafeInteger(options.seed) || options.seed<0 || options.seed>0xffffffff || !Number.isSafeInteger(options.perMultiplier) || options.perMultiplier<1 || options.perMultiplier>LIBRARY_LIMITS.perMultiplier) throw new Error('生成参数无效：局数 1–1亿，每倍率保留 1–10000 条，种子为 uint32。');
}
export class LibraryGenerator {
  readonly config: CascadeConfig;
  readonly options: LibraryOptions;
  readonly stats: LibraryStats = {completed:0,wins:0,losses:0,limited:0,retained:0,duplicates:0,capacitySkipped:0,bucketCount:0};
  readonly buckets: LibraryBuckets = {};
  private seen = new Map<string,number>();
  private fingerprints = new Map<string,Set<string>>();
  private bytes = 0;
  private selection: ()=>number;
  constructor(config: CascadeConfig, options: LibraryOptions, private random: ()=>number) {
    validateCascadeConfig(config); validateLibraryOptions(options);
    if (config.symbols.some(s=>!/^[1-9]\d{0,2}$/.test(s.id))) throw new Error('生成盘面库需要 1–999 的基础图标 ID。');
    this.config = structuredClone({...config,lineCount:1}); this.options = {...options};
    let value = options.seed ^ 0x9e3779b9;
    this.selection = () => { value = (Math.imul(value,1664525) + 1013904223) >>> 0; return value / 4294967296; };
  }
  get done() { return this.stats.completed >= this.options.count; }
  step(count = 1) {
    for (let n=0;n<count && !this.done;n++) {
      let round = createCascadeRound(this.config,this.random,undefined,this.options.mode);
      while (!round.finished && !round.limited) round = advanceCascadeRound(round,this.config,this.random);
      this.stats.completed++;
      if (round.limited) {this.stats.limited++;continue;}
      if (!round.steps.length) {this.stats.losses++;continue;}
      this.stats.wins++;
      const key = rawMultiplierKey(round,this.config), skeleton = encodeSkeleton(round);
      // Every retained candidate is replayed without the nonwinning cells.
      if (inspectSkeleton(skeleton,this.config,this.options.mode).key !== key) throw new Error('骨架重放倍率不一致，已停止生成。');
      if (!this.buckets[key]) {
        if (this.stats.bucketCount >= LIBRARY_LIMITS.buckets) throw new Error('倍率种类超过10000，请缩小配置范围后分批生成。');
        this.buckets[key]=[];this.fingerprints.set(key,new Set());this.stats.bucketCount++;
      }
      const seen = (this.seen.get(key) ?? 0) + 1; this.seen.set(key,seen);
      const fingerprint = JSON.stringify(skeleton), set = this.fingerprints.get(key)!;
      if (set.has(fingerprint)) {this.stats.duplicates++;continue;}
      const bucket = this.buckets[key];
      const index = bucket.length < this.options.perMultiplier ? bucket.length : Math.floor(this.selection()*seen);
      if (index >= this.options.perMultiplier) continue;
      const old = bucket[index] ? JSON.stringify(bucket[index]) : null;
      const delta = fingerprint.length - (old?.length ?? 0);
      if ((!old && this.stats.retained >= LIBRARY_LIMITS.records) || this.bytes + delta > LIBRARY_LIMITS.bytes) {this.stats.capacitySkipped++;continue;}
      if (old) set.delete(old); else this.stats.retained++;
      bucket[index]=skeleton;set.add(fingerprint);this.bytes+=delta;
    }
  }
  result(): LibraryResult {
    const buckets = Object.fromEntries(Object.entries(this.buckets).filter(([,rows])=>rows.length));
    return {version:1,options:{...this.options},stats:{...this.stats},buckets};
  }
}

export function validateLibrary(value: LibraryResult, config: CascadeConfig): LibraryResult {
  if (!value || value.version!==1) throw new Error('盘面库版本无效。');
  validateLibraryOptions(value.options);
  const stats=value.stats;
  if (!stats || !Object.values(stats).every(v=>Number.isSafeInteger(v)&&v>=0) || stats.completed<1 || stats.completed>value.options.count || stats.completed!==stats.wins+stats.losses+stats.limited || !value.buckets || typeof value.buckets!=='object' || Array.isArray(value.buckets)) throw new Error('盘面库统计或倍率分桶无效。');
  let retained=0;
  if (Object.keys(value.buckets).length>LIBRARY_LIMITS.buckets) throw new Error('倍率分桶过多。');
  for (const [key, rows] of Object.entries(value.buckets)) {
    if (!Array.isArray(rows) || !rows.length || rows.length>value.options.perMultiplier) throw new Error('倍率样本数量无效。');
    const seen = new Set<string>();
    for (const row of rows) {
      if (inspectSkeleton(row,config,value.options.mode).key!==key) throw new Error('骨架与倍率分桶不一致。');
      const text=JSON.stringify(row);if(seen.has(text))throw new Error('同一倍率包含重复骨架。');seen.add(text);
    }
    retained+=rows.length;
  }
  if (retained!==stats.retained || retained>LIBRARY_LIMITS.records || retained>stats.wins) throw new Error('保留样本统计不一致。');
  return value;
}

/** 只统计已验证骨架中的固定中奖图标；普通补牌不计入中奖覆盖。 */
export function auditLibrary(value: LibraryResult, config: CascadeConfig, weights: Array<[number, number]>) {
  const symbols = config.symbols.filter(symbol => symbol.role === 'normal' && symbol.weight > 0 &&
    Object.values(symbol.payouts).some(pay => pay > 0));
  const counts = new Map(symbols.map(symbol => [symbol.id, 0]));
  const required = [...new Set(weights.filter(([multiplier, weight]) => multiplier > 0 && weight > 0)
    .map(([multiplier]) => String(multiplier)))];
  for (const key of required) {
    for (const row of value.buckets[key] ?? []) {
      const participating = new Set<string>();
      let offset = 0;
      while (offset < row.length) {
        const count = row[offset++];
        for (let i = 0; i < count; i++) {
          offset++;
          const id = row[offset++];
          participating.add(String(id > 1000 ? id - 1000 : id));
        }
      }
      participating.forEach(id => { if (counts.has(id)) counts.set(id, counts.get(id)! + 1); });
    }
  }
  const symbolWins = symbols.map(symbol => ({ id: symbol.id, name: symbol.name, records: counts.get(symbol.id)! }));
  const missingMultipliers = required.filter(key => !value.buckets[key]?.length);
  return {
    symbolWins,
    missingMultipliers,
    coveredMultipliers: required.length - missingMultipliers.length,
    requiredMultipliers: required.length,
    ready: required.length > 0 && !missingMultipliers.length && symbolWins.every(symbol => symbol.records > 0),
  };
}
