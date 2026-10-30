import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cascadeUrl = url(compile(readFileSync(new URL('../../src/domain/cascade.ts', import.meta.url), 'utf8')));
export const cascade = await import(cascadeUrl);
export const board = await import(url(compile(readFileSync(new URL('../../src/domain/board.ts', import.meta.url), 'utf8')).replace("from './cascade'", `from '${cascadeUrl}'`)));
export const symbol = (id, role = 'normal', weight = 1) => ({ id, name: id, role, weight, color: '#547cbb', payouts: role === 'normal' ? { 3: 5, 4: 10, 5: 20, 6: 40 } : {} });
export const setup = (columnHeights = [1, 1, 1]) => ({ scatterWeightIncrement: 0, fillWeightIncrement: 0, gold: { columns: [], baseProbability: 0, freeProbability: 0, wildSymbolId: null }, columnHeights, lineCount: 20, cascadeFactors: [1, 2, 3, 5], freeCascadeFactors: [2, 4, 6, 10], symbols: [symbol('A', 'normal', 0), { ...symbol('B'), payouts: {} }, symbol('W', 'wild', 0), symbol('S', 'scatter', 0)] });
export const boardFixture = () => {
  const { lineCount, ...config } = setup([4, 4, 4, 4, 4]);
  return { version: 1, ...config, seed: 42 };
};
export const library = await import(url(compile(readFileSync(new URL('../../src/domain/boardLibrary.ts', import.meta.url), 'utf8')).replace("from './cascade'", `from '${cascadeUrl}'`)));

export const fill = await import(url(compile(readFileSync(new URL('../../src/domain/boardFill.ts', import.meta.url), 'utf8')).replace("from './cascade'", `from '${cascadeUrl}'`)));
