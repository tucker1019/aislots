import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from '../../../slot_math/node_modules/typescript/lib/typescript.js';
const source=fs.readFileSync(new URL('../assets/wildbountyshowdown/src/wbsgame/mgr/WBSGameManager.ts',import.meta.url),'utf8');
const method=source.slice(source.indexOf('    getBottomSymbol('),source.indexOf('    getFactor()'));
const js=ts.transpileModule('export class BottomReader {'+method+'}',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};new Function('exports','module',js)(m.exports,m);
test('AG3 consumes six persisted bottom cells in live, restored and replay frames; legacy only falls back',()=>{
 const reader=new m.exports.BottomReader();reader.getRandomType=()=>7;
 const values=[1,2,1003,4,5,8];reader.frame={bottomSymbols:values};assert.deepEqual(values.map((_,c)=>reader.getBottomSymbol(c)),values);
 reader.frame=JSON.parse(JSON.stringify(reader.frame));assert.deepEqual(values.map((_,c)=>reader.getBottomSymbol(c)),values);
 reader.frame={};assert.equal(reader.getBottomSymbol(0),7);
 reader.frame={bottomSymbols:[1]};assert.throws(()=>reader.getBottomSymbol(0),/底部格子/);
});
