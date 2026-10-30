export type BoardMode = 'base' | 'free';
export type SymbolRole = 'normal' | 'wild' | 'scatter';
export interface GameSymbol { id: string; name: string; weight: number; role: SymbolRole; color: string; payouts: Record<number, number> }
export interface GoldConfig { columns: number[]; baseProbability: number; freeProbability: number; wildSymbolId: string | null }
export interface BoardConfig { fillWeightIncrement: number; scatterWeightIncrement: number; gold: GoldConfig; columnHeights: number[]; symbols: GameSymbol[]; cascadeFactors: number[]; freeCascadeFactors: number[] }
export interface CascadeConfig extends BoardConfig { lineCount: number }
export interface Cell { id: number; symbolId: string }
export type Board = Cell[][]; // Each column is ordered top to bottom.
export interface WaysWin { symbolId: string; columns: number; counts: number[]; ways: number; payMultiplier: number; factor: number; payout: number; cellIds: number[] }
export interface CascadeStep { index: number; before: Board; after: Board; wins: WaysWin[]; removedIds: number[]; transformedIds: number[]; refillIds: number[]; factor: number; payout: number }
export interface CascadeRound {
  mode: BoardMode; board: Board; steps: CascadeStep[]; totalPayout: number;
  nextCellId: number; finished: boolean; limited: boolean;
}
export const MAX_CASCADES = 100;
export function validateCascadeConfig(config: CascadeConfig, allowEmpty = false): void {
  if (!config || !Array.isArray(config.columnHeights) || config.columnHeights.length < 3 || config.columnHeights.length > 12 || !config.columnHeights.every(x=>Number.isSafeInteger(x)&&x>=1&&x<=12)) throw new Error('棋盘需要 3–12 列，每列 1–12 个格子。');
  if (!Number.isFinite(config.fillWeightIncrement) || config.fillWeightIncrement < 0 || config.fillWeightIncrement > 1e9) throw new Error('补空累计加权 n 必须为0–10亿的有限数。');
  if (!Number.isFinite(config.scatterWeightIncrement) || config.scatterWeightIncrement < 0 || config.scatterWeightIncrement > 1e9) throw new Error('免费图标加权 n 必须为0–10亿的有限数。');
  if (!Number.isSafeInteger(config.lineCount) || config.lineCount < 1) throw new Error('线数必须为正整数。');
  for (const [name, factors] of [['普通', config.cascadeFactors], ['免费', config.freeCascadeFactors]] as const) {
    if (!Array.isArray(factors) || !factors.length || factors.length > 30 || !factors.every(x => Number.isFinite(x) && x > 0)) throw new Error(`${name}连续消除加成需要 1–30 档，每档为大于 0 的有限数。`);
  }
  if (!Array.isArray(config.symbols) || (!allowEmpty && !config.symbols.length)) throw new Error('请先添加至少一个图标。');
  const ids = new Set<string>(); let sum=0;
  for(const symbol of config.symbols) {
    if(!symbol || typeof symbol.id!=='string' || !symbol.id || ids.has(symbol.id)) throw new Error('图标标识必须唯一。');
    ids.add(symbol.id);
    if(typeof symbol.name!=='string'||!symbol.name.trim()||!['normal','wild','scatter'].includes(symbol.role)||!Number.isFinite(symbol.weight)||symbol.weight<0) throw new Error('请为每个图标填写名称、类型和非负权重。');
    if(typeof symbol.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(symbol.color)) throw new Error('图标颜色必须是六位十六进制颜色。');
    if(symbol.role === 'wild' && symbol.weight !== 0) throw new Error('百搭权重必须为0，只能由金底转换生成。');
    if(!symbol.payouts || typeof symbol.payouts !== 'object' || Array.isArray(symbol.payouts) || Object.entries(symbol.payouts).some(([columns,pay])=>!Number.isInteger(Number(columns))||Number(columns)<3||Number(columns)>12||!Number.isFinite(pay)||pay<0)) throw new Error('赔付表的列数应为 3–12，赔付应为有限非负数。');
    if(symbol.role === 'normal') sum+=symbol.weight;
  }
  const gold = config.gold;
  if (!gold || !Array.isArray(gold.columns) || new Set(gold.columns).size !== gold.columns.length || gold.columns.some(c => !Number.isSafeInteger(c) || c < 1 || c > 12)
    || ![gold.baseProbability, gold.freeProbability].every(p => Number.isFinite(p) && p >= 0 && p <= 1)
    || (gold.wildSymbolId !== null && typeof gold.wildSymbolId !== 'string')) throw new Error('金底配置需要不重复的轴号（1–12）及 0–1 的普通、免费概率。');
  if (gold.wildSymbolId !== null && !config.symbols.some(s => s.id === gold.wildSymbolId && s.role === 'wild')) throw new Error('金底转换目标必须是图标库中的百搭。');
  if (gold.columns.length) {
    if (gold.wildSymbolId === null) throw new Error('启用金底轴前，请先配置转换目标百搭。');
  }
  if (gold.wildSymbolId !== null) {
    if (config.symbols.some(s => !/^[1-9]\d{0,2}$/.test(s.id))) throw new Error('启用金底时，基础图标 ID 必须为 1–999 的整数字符串；1000 以上留给金底 ID。');
  }
  if(!Number.isFinite(sum) || (!allowEmpty && sum<=0)) throw new Error('普通图标的权重总和必须为有限的正数。');
}
export function cascadeFactor(config: CascadeConfig, index: number, mode: BoardMode = 'base'): number {
  if (mode !== 'base' && mode !== 'free') throw new Error('盘面模式必须是普通或免费。');
  const factors = mode === 'free' ? config.freeCascadeFactors : config.cascadeFactors;
  return factors[Math.min(index, factors.length - 1)];
}
/** Gold variants are derived IDs, never separate weighted symbols. */
export function symbolDefinitions(config: BoardConfig) {
  const symbols = new Map(config.symbols.map(symbol => [symbol.id, { ...symbol, baseSymbolId: symbol.id, gold: false }]));
  if (config.gold.wildSymbolId !== null) {
    for (const symbol of config.symbols.filter(s => s.role === 'normal' && /^[1-9]\d{0,2}$/.test(s.id))) {
      const id = String(Number(symbol.id) + 1000);
      symbols.set(id, { ...symbol, id, name: `金底${symbol.name}`, weight: 0, baseSymbolId: symbol.id, gold: true });
    }
  }
  return symbols;
}
export function validateBoard(board: Board, config: CascadeConfig): void {
  if (!Array.isArray(board) || board.length !== config.columnHeights.length) throw new Error('盘面列数与配置不一致。');
  const symbols = symbolDefinitions(config), ids = new Set<number>();
  board.forEach((column, c) => {
    if (!Array.isArray(column) || column.length !== config.columnHeights[c]) throw new Error('盘面格数与列高配置不一致。');
    for (const cell of column) {
      if (!cell || !Number.isSafeInteger(cell.id) || cell.id < 1 || ids.has(cell.id) || !symbols.has(cell.symbolId)) throw new Error('盘面图标无效，或格子标识重复。');
      if (symbols.get(cell.symbolId)!.gold && !config.gold.columns.includes(c + 1)) throw new Error('金底图标只能放在已配置的金底轴。');
      ids.add(cell.id);
    }
  });
}
export function evaluateWays(board: Board, config: CascadeConfig, index: number, mode: BoardMode = 'base'): WaysWin[] {
  validateBoard(board, config);
  const symbols = symbolDefinitions(config);
  const wins: WaysWin[]=[];
  const factor=cascadeFactor(config,index,mode);
  for(const symbol of config.symbols.filter(s=>s.role==='normal')) {
    const counts:number[]=[], cells:Cell[]=[]; let hasNatural=false;
    for(const column of board) {
      const matches=column.filter(cell=>symbols.get(cell.symbolId)?.baseSymbolId===symbol.id||symbols.get(cell.symbolId)?.role==='wild');
      if(!matches.length) break;
      counts.push(matches.length); cells.push(...matches);
      if(matches.some(cell=>symbols.get(cell.symbolId)?.baseSymbolId===symbol.id)) hasNatural=true;
    }
    if(counts.length<3||!hasNatural) continue;
    const payMultiplier=(symbol.payouts[counts.length]??0)/config.lineCount;
    if(payMultiplier<=0) continue;
    const ways=counts.reduce((a,b)=>a*b,1), payout=payMultiplier*ways*factor;
    if(!Number.isFinite(payout)) throw new Error('奖金超出数值范围，请降低赔付或加成。');
    wins.push({symbolId:symbol.id,columns:counts.length,counts,ways,payMultiplier,factor,payout,cellIds:cells.map(c=>c.id)});
  }
  return wins;
}
function drawRandom(random: () => number): number {
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('随机值必须位于 [0, 1)。');
  return draw;
}
function picker(config: CascadeConfig, random:()=>number, mode: BoardMode):(column: number)=>string {
  const symbols = config.symbols.filter(symbol => symbol.role === 'normal' && symbol.weight > 0);
  const total = symbols.reduce((sum, symbol) => sum + symbol.weight, 0);
  const probability = mode === 'free' ? config.gold.freeProbability : config.gold.baseProbability;
  return column => {
    let target = drawRandom(random) * total;
    let selected = symbols.at(-1)!;
    for (const symbol of symbols) { target -= symbol.weight; if (target < 0) { selected = symbol; break; } }
    return config.gold.columns.includes(column + 1) && probability > 0 && drawRandom(random) < probability
      ? String(Number(selected.id) + 1000) : selected.id;
  };
}
export function createCascadeRound(config: CascadeConfig, random:()=>number, preset?:Array<Array<string|null>>, mode: BoardMode = 'base'):CascadeRound {
  validateCascadeConfig(config);
  cascadeFactor(config, 0, mode);
  const pick = picker(config, random, mode), validIds = symbolDefinitions(config); let id = 1;
  if (preset && (preset.length !== config.columnHeights.length || preset.some((column, c) => !Array.isArray(column) || column.length !== config.columnHeights[c] || column.some(symbol => symbol !== null && !validIds.has(symbol))))) throw new Error('手动盘面的结构或图标与配置不一致。');
  const board = config.columnHeights.map((height,c) => Array.from({length:height},(_,r) => ({ id:id++, symbolId:preset?.[c][r] ?? pick(c) })));
  validateBoard(board, config);
  return {mode,board,steps:[],totalPayout:0,nextCellId:id,finished:false,limited:false};
}
export function advanceCascadeRound(round:CascadeRound,config:CascadeConfig,random:()=>number):CascadeRound {
  if(round.finished||round.limited)return round;
  const wins=evaluateWays(round.board,config,round.steps.length,round.mode);
  if(!wins.length)return {...round,finished:true};
  if(round.steps.length>=MAX_CASCADES)return {...round,limited:true};
  const winning = new Set(wins.flatMap(win => win.cellIds));
  const definitions = symbolDefinitions(config);
  const transformedIds = round.board.flat().filter(cell => winning.has(cell.id) && definitions.get(cell.symbolId)!.gold).map(cell => cell.id);
  const transformed = new Set(transformedIds);
  const removedIds = [...winning].filter(id => !transformed.has(id)), removed = new Set(removedIds), refillIds: number[] = [];
  const pick = picker(config, random, round.mode); let id = round.nextCellId;
  const after = round.board.map((column, c) => {
    // Replace winning gold in place first, then let it fall with the survivors.
    const survivors = column.filter(cell => !removed.has(cell.id)).map(cell => transformed.has(cell.id) ? { ...cell, symbolId: config.gold.wildSymbolId! } : cell);
    const fresh = Array.from({length: config.columnHeights[c] - survivors.length}, () => {
      const cell = {id: id++, symbolId: pick(c)}; refillIds.push(cell.id); return cell;
    });
    return [...fresh, ...survivors];
  });
  const payout=wins.reduce((sum,w)=>sum+w.payout,0), totalPayout=round.totalPayout+payout;
  if(!Number.isFinite(totalPayout))throw new Error('累计奖金超出数值范围。');
  const step:CascadeStep={index:round.steps.length+1,before:round.board,after,wins,removedIds,transformedIds,refillIds,payout,factor:cascadeFactor(config,round.steps.length,round.mode)};
  return {...round,board:after,steps:[...round.steps,step],nextCellId:id,totalPayout};
}
