import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(url){const m={exports:{}};const source=fs.readFileSync(url,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(p=>load(new URL(p+'.ts',url)),m.exports,m);return m.exports;}
const engine=load(new URL('../src/domain/fortuneTiger.ts',import.meta.url));
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../../game_configs/AG4/paylines.json',import.meta.url)));
const sequence=values=>{let i=0;return()=>{assert.ok(i<values.length,'unexpected random draw');return values[i++];};};
function featureConfig(){const c=fixture();c.feature={type:'fortune_tiger_v1',fillProbability:.2,targetWeights:[{symbolId:1,weight:1}],baseSpreadWeights:[1,0,0]};return c;}
test('x10 is a full board of identical symbols, not three different horizontal wins',()=>{
 const r=engine.evaluateFortuneTiger(fixture(),[1,2,3,1,2,3,1,2,3]);assert.equal(r.wins.length,3);assert.equal(r.bonusMultiplier,1);assert.equal(r.totalBetMultiplier,3.2);
 assert.equal(engine.evaluateFortuneTiger(fixture(),Array(9).fill(7)).totalBetMultiplier,2500);
});
test('feature starts empty, fills only the selected symbol and pays once at the end',()=>{
 const c=featureConfig();c.feature.fillProbability=1;const r=engine.runFortuneTigerRound(c,1000n,()=>0,'free');
 assert.equal(r.mode,'feature');assert.deepEqual(r.frames[0].board,Array(9).fill(0));assert.deepEqual(r.frames.at(-1).board,Array(9).fill(1));assert.equal(r.endReason,'filled');
 assert.equal(r.winMinor,'30000');assert.equal(r.profitMinor,'29000');assert.equal(r.frames.reduce((n,f)=>n+BigInt(f.chargeMinor),0n),1000n);
 assert.ok(r.frames.slice(0,-1).every(f=>f.winMinor==='0'));assert.equal(r.frames.at(-1).winMinor,r.winMinor);
});
test('locks persist, a no-growth final spin is explicit, and intermediate wins are not accumulated',()=>{
 const c=featureConfig();const first=Array(9).fill(.9);first[0]=first[3]=first[6]=0;
 const r=engine.runFortuneTigerRound(c,1000n,sequence([0,...first,...Array(6).fill(.9)]),'free');
 assert.equal(r.endReason,'no_new_symbol');assert.equal(r.frames.length,3);assert.deepEqual(r.frames[1].board,r.frames[2].board);assert.deepEqual(r.frames[1].addedCellIds,[1,4,7]);assert.deepEqual(r.frames[2].addedCellIds,[]);
 assert.equal(r.winMinor,'600');assert.equal(r.frames[1].winMinor,'0');assert.equal(r.frames[2].winMinor,'600');assert.ok(r.frames.every(f=>f.board.every(s=>s===0||s===1)));
});
test('an empty first attempt ends with zero award; invalid random and wager are rejected',()=>{
 const r=engine.runFortuneTigerRound(featureConfig(),1000n,sequence([0,...Array(9).fill(.9)]),'free');assert.equal(r.winMinor,'0');assert.equal(r.frames.length,2);
 assert.throws(()=>engine.runFortuneTigerRound(featureConfig(),0n,()=>0,'free'));assert.throws(()=>engine.runFortuneTigerRound(featureConfig(),1n,()=>1,'free'));
});
test('ordinary spin only charges once and supports AG4 upward spreading',()=>{
 const c=featureConfig();c.feature.baseSpreadWeights=[0,0,1];c.symbols.forEach(s=>s.weight=s.id===1?1:0);
 const r=engine.runFortuneTigerRound(c,1000n,()=>.5);assert.equal(r.mode,'normal');assert.equal(r.frames.length,1);assert.equal(r.winMinor,'30000');
});
