import { parseWeightTable, type WeightRow, type WeightTable } from './model';

export interface DraftRow { id: number; sourceMultiplier: number; multiplierText: string; weightText: string }
export function createWeightDraft(table: WeightTable, lineCount: number): DraftRow[] {
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) throw new Error('请先填写有效线数。');
  return table.rows.map(([multiplier, weight], index) => ({ id: index + 1, sourceMultiplier: multiplier, multiplierText: String(multiplier / lineCount), weightText: String(weight) }));
}
export function draftRowValues(row: DraftRow, lineCount: number): WeightRow {
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) throw new Error('线数必须为正整数。');
  if (!row.multiplierText.trim() || !row.weightText.trim()) throw new Error('实际倍率和权重不能为空。');
  const actualMultiplier = Number(row.multiplierText), weight = Number(row.weightText);
  if (![actualMultiplier, weight].every(x => Number.isFinite(x) && x >= 0)) throw new Error('实际倍率和权重必须为有限的非负数。');
  // Unedited source multipliers retain their original floating-point value exactly.
  const rawMultiplier = row.multiplierText === String(row.sourceMultiplier / lineCount) ? row.sourceMultiplier : actualMultiplier * lineCount;
  if (!Number.isFinite(rawMultiplier)) throw new Error('倍率超出数值范围。');
  return [rawMultiplier, weight];
}
export function tableFromDraft(rows: DraftRow[], lineCount: number): WeightTable {
  return parseWeightTable(JSON.stringify(rows.map(row => draftRowValues(row, lineCount))));
}
export function weightFromPosition(clientY: number, top: number, height: number, maximum: number, logarithmic: boolean): number {
  const ratio = Math.max(0, Math.min(1, (top + height - clientY) / height));
  return logarithmic ? Math.expm1(ratio * Math.log1p(maximum)) : ratio * maximum;
}
