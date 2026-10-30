import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const modelUrl = url(compile(readFileSync(new URL('../../src/domain/model.ts', import.meta.url), 'utf8')));
export const model = await import(modelUrl);
export const settings = await import(url(compile(readFileSync(new URL('../../src/domain/settings.ts', import.meta.url), 'utf8')).replace("from './model'", `from '${modelUrl}'`)));
export function readFixture() {
  return {
    base: JSON.parse(readFileSync(new URL('../../data/base.json', import.meta.url), 'utf8')),
    free: JSON.parse(readFileSync(new URL('../../data/free.json', import.meta.url), 'utf8')),
    config: JSON.parse(readFileSync(new URL('../fixtures/config.json', import.meta.url), 'utf8')),
  };
}
