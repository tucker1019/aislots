/** Positions are 1-based, column-major, top to bottom. Symbol IDs are client IDs. */
export interface PaylineSymbol { id: number; name: string; role: 'normal' | 'wild'; payout: number; weight: number }
export interface PaylineConfig { version: 1; ruleType: 'paylines_v1'; columnHeights: number[]; lines: number[][]; symbols: PaylineSymbol[] }
export interface PaylineDocument { gameId: string; revision: string; file: PaylineConfig }
export function gridCells(heights: number[]) {
  let id = 0;
  return heights.flatMap((height, column) => Array.from({ length: height }, (_, row) => ({ id: ++id, column, row })));
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9; }
export function validatePaylines(value: unknown): PaylineConfig {
  if (!object(value) || value.version !== 1 || value.ruleType !== 'paylines_v1') throw new Error('连线配置需要 version: 1、ruleType: paylines_v1。');
  for (const key of Object.keys(value)) if (!['version','ruleType','columnHeights','lines','symbols'].includes(key)) throw new Error(`连线配置不支持字段 ${key}。`);
  const heights = value.columnHeights;
  if (!Array.isArray(heights) || heights.length < 1 || heights.length > 12 || heights.some(h => !Number.isSafeInteger(h) || h < 1 || h > 12)) throw new Error('每列格数必须为 1～12，最多 12 列。');
  const size = heights.reduce((a: number,b: number) => a+b, 0);
  if (!Array.isArray(value.lines) || !value.lines.length || value.lines.length > 1000) throw new Error('需要 1～1000 组中奖格子。');
  const seen = new Set<string>();
  for (const line of value.lines) {
    if (!Array.isArray(line) || line.length < 2 || line.some(id => !Number.isSafeInteger(id) || id < 1 || id > size) || new Set(line).size !== line.length) throw new Error('每组至少两个有效格子，不能重复或越界。');
    const key = [...line].sort((a: number,b: number) => a-b).join(',');
    if (seen.has(key)) throw new Error('中奖格子组合重复（顺序不同也算同一组）。');
    seen.add(key);
  }
  if (!Array.isArray(value.symbols) || !value.symbols.length || value.symbols.length > 100) throw new Error('需要 1～100 个符号。');
  const ids = new Set<number>();
  for (const symbol of value.symbols) {
    if (!object(symbol) || !Number.isSafeInteger(symbol.id) || (symbol.id as number) < 1 || (symbol.id as number) > 1000000 || ids.has(symbol.id as number)) throw new Error('符号 ID 必须为唯一正整数；0 保留为空白。');
    ids.add(symbol.id as number);
    if (typeof symbol.name !== 'string' || !symbol.name.trim() || symbol.name.length > 80 || !['normal','wild'].includes(String(symbol.role)) || !finite(symbol.payout) || !finite(symbol.weight)) throw new Error('符号名称、类型、赔率或权重无效。');
    for (const key of Object.keys(symbol)) if (!['id','name','role','payout','weight'].includes(key)) throw new Error(`符号不支持字段 ${key}。`);
  }
  if (!value.symbols.some(s => s.weight > 0)) throw new Error('至少一个符号的生成权重必须大于 0。');
  return value as unknown as PaylineConfig;
}
export interface PaylineWin { lineIndex: number; cellIds: number[]; symbolId: number; payout: number }
export function evaluatePaylines(config: PaylineConfig, board: number[]) {
  validatePaylines(config);
  const ids = new Set(config.symbols.map(s => s.id));
  if (!Array.isArray(board) || board.length !== gridCells(config.columnHeights).length || board.some(id => id !== 0 && !ids.has(id))) throw new Error('测试盘面格数或符号 ID 无效。');
  const wilds = new Set(config.symbols.filter(s => s.role === 'wild').map(s => s.id));
  const wins: PaylineWin[] = [];
  config.lines.forEach((cellIds,lineIndex) => {
    // All positions in a configured group must match. No implicit prefix or geometric constraint.
    const candidates = config.symbols.filter(s => s.payout > 0 && cellIds.every(id => board[id-1] === s.id || wilds.has(board[id-1])));
    candidates.sort((a,b) => b.payout-a.payout || a.id-b.id);
    const best = candidates[0];
    if (best) wins.push({ lineIndex, cellIds: [...cellIds], symbolId: best.id, payout: best.payout });
  });
  const rawPayout = wins.reduce((sum,w) => sum+w.payout,0);
  return { wins, rawPayout, totalBetMultiplier: rawPayout/config.lines.length, winningCellIds: [...new Set(wins.flatMap(w=>w.cellIds))].sort((a,b)=>a-b) };
}
export function generatePaylineBoard(config: PaylineConfig, random: () => number = Math.random): number[] {
  validatePaylines(config);
  const symbols = config.symbols.filter(s => s.weight > 0), total = symbols.reduce((sum,s)=>sum+s.weight,0);
  return gridCells(config.columnHeights).map(() => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机源必须返回 [0, 1) 的数字。');
    let cursor = value*total;
    for (const s of symbols) { cursor -= s.weight; if (cursor < 0) return s.id; }
    return symbols[symbols.length-1].id;
  });
}
