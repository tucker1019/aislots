import { validateCascadeConfig, type BoardConfig, type CascadeConfig } from './cascade';
export interface BoardFile extends BoardConfig { version: 1; seed: number | null }
export interface BoardDocument { gameId: string; revision: string; lineCount: number; file: BoardFile }
export function validateBoardFile(value: unknown): BoardFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('board.json 必须是 JSON 对象。');
  const file = value as BoardFile;
  if (file.version !== 1) throw new Error('board.json 的 version 必须为 1。');
  for (const key of ['lineCount', 'freeFactor', 'scatterThreshold', 'freeSpinsAward']) {
    if (key in file) throw new Error(`board.json 不保存 ${key}；线数读取 config.json，盘面工具不执行免费规则。`);
  }
  const allowed = new Set(['version', 'fillWeightIncrement', 'scatterWeightIncrement', 'gold', 'freeGoldColumns', 'columnHeights', 'cascadeFactors', 'freeCascadeFactors', 'symbols', 'seed']);
  for (const key of Object.keys(file)) if (!allowed.has(key)) throw new Error(`board.json 不支持字段 ${key}。`);
  if (file.seed !== null && (!Number.isSafeInteger(file.seed) || file.seed < 0 || file.seed > 0xffffffff)) throw new Error('board.json 的 seed 必须是 0～4294967295 的整数，或 null。');
  validateCascadeConfig({ ...file, lineCount: 1 }, true);
  return file;
}
export function runtimeBoardConfig(file: BoardFile, lineCount: number): CascadeConfig {
  validateBoardFile(file);
  const config = { fillWeightIncrement: file.fillWeightIncrement, scatterWeightIncrement: file.scatterWeightIncrement, gold: structuredClone(file.gold), ...(file.freeGoldColumns === undefined ? {} : { freeGoldColumns: [...file.freeGoldColumns] }), columnHeights: structuredClone(file.columnHeights), symbols: structuredClone(file.symbols), cascadeFactors: [...file.cascadeFactors], freeCascadeFactors: [...file.freeCascadeFactors], lineCount };
  validateCascadeConfig(config, true);
  return config;
}
export function fileFromBoard(config: CascadeConfig, seed: string): BoardFile {
  const value = seed.trim() ? Number(seed) : null;
  return validateBoardFile({ version: 1, fillWeightIncrement: config.fillWeightIncrement, scatterWeightIncrement: config.scatterWeightIncrement, gold: config.gold, ...(config.freeGoldColumns === undefined ? {} : { freeGoldColumns: config.freeGoldColumns }), columnHeights: config.columnHeights, symbols: config.symbols, cascadeFactors: config.cascadeFactors, freeCascadeFactors: config.freeCascadeFactors, seed: value });
}
