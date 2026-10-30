import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = text => ts.transpile(text, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const modelUrl = url(compile(readFileSync(new URL('../src/domain/model.ts', import.meta.url),'utf8')));
const { parseWeightTable, calculateModel } = await import(modelUrl);
const module = compile(readFileSync(new URL('../src/domain/weightDraft.ts',import.meta.url),'utf8')).replace("from './model'",`from '${modelUrl}'`);
const { createWeightDraft, tableFromDraft, weightFromPosition } = await import(url(module));
const source = parseWeightTable('[[1,1],[5,2],[20,1]]');
const p = {lineCount:20,baseSpinWinProbability:0.4,freeSpinWinProbability:0.5,freeSpinTriggerProbability:0.02,freeSpinsPerTrigger:8};
test('draft edits preview RTP without mutating the saved table',()=>{
 const before = JSON.stringify(source);
 const draft=createWeightDraft(source,20);
 draft[0].weightText='100';
 const edited=tableFromDraft(draft,20);
 assert.notEqual(calculateModel(edited,source,p).totalRtp,calculateModel(source,source,p).totalRtp);
 assert.equal(JSON.stringify(source),before);
 assert.equal(edited.rows[0][0],1);
});
test('unchanged fractional multipliers and decimal weights round trip exactly',()=>{
 const original=parseWeightTable('[[0.1,358895.7650801],[1.234567890123,0.0000000000123]]');
 assert.deepEqual(tableFromDraft(createWeightDraft(original,37),37).rows,original.rows);
});
test('edited and added actual multipliers convert back to file units exactly once',()=>{
 const draft=createWeightDraft(source,20);draft[0].multiplierText='0.5';
 draft.push({id:99,sourceMultiplier:NaN,multiplierText:'1.25',weightText:'3.5'});
 const result=tableFromDraft(draft,20);
 assert.deepEqual(result.rows[0],[10,1]);assert.deepEqual(result.rows.at(-1),[25,3.5]);
});
test('deletion affects draft only and permits recovery by adding a row',()=>{
 const draft=createWeightDraft(source,20);draft.splice(1,1);
 assert.equal(tableFromDraft(draft,20).rows.length,2);assert.equal(source.rows.length,3);
 assert.throws(()=>tableFromDraft([],20));
 assert.equal(tableFromDraft([{id:1,sourceMultiplier:NaN,multiplierText:'2',weightText:'1'}],20).rows[0][0],40);
});
test('invalid drafts cannot be saved',()=>{
 for(const text of ['', '-1', 'NaN', 'Infinity']) {
  const rows=createWeightDraft(source,20); rows[0].weightText=text;assert.throws(()=>tableFromDraft(rows,20));
  const multipliers=createWeightDraft(source,20);multipliers[0].multiplierText=text;assert.throws(()=>tableFromDraft(multipliers,20));
 }
 const rows=createWeightDraft(source,20);rows.forEach(r=>r.weightText='0');assert.throws(()=>tableFromDraft(rows,20));
});
test('linear and logarithmic dragging clamp to chart bounds',()=>{
 assert.equal(weightFromPosition(100,100,200,1000,false),1000);
 assert.equal(weightFromPosition(300,100,200,1000,false),0);
 assert.equal(weightFromPosition(200,100,200,1000,false),500);
 assert.equal(weightFromPosition(500,100,200,1000,false),0);
 assert.ok(Math.abs(weightFromPosition(200,100,200,999,true)-(Math.sqrt(1000)-1))<1e-10);
});
test('600-row production table retains all records and source values when drafting',()=>{
 const original=parseWeightTable(readFileSync(new URL('../data/base.json',import.meta.url),'utf8'));
 const restored=tableFromDraft(createWeightDraft(original,20),20);
 assert.deepEqual(restored.rows,original.rows);
});
