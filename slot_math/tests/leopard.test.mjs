import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTypeScript} from './helpers/typescript.mjs';
const rules=loadTypeScript(new URL('../src/domain/fortuneLeopard.ts',import.meta.url));
const tiger=loadTypeScript(new URL('../src/domain/fortuneTiger.ts',import.meta.url));
const skeletons=loadTypeScript(new URL('../src/domain/tigerSkeleton.ts',import.meta.url));
const {validatePaylines}=loadTypeScript(new URL('../src/domain/paylines.ts',import.meta.url));
const {validateGameFiles}=loadTypeScript(new URL('../src/domain/settings.ts',import.meta.url));
const {RespinSimulation}=loadTypeScript(new URL('../src/domain/respinSimulation.ts',import.meta.url));
const {seededRandom}=loadTypeScript(new URL('../src/domain/simulation.ts',import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(new URL('../../game_configs/AG9/'+name,import.meta.url)));
const config=read('paylines.json'),files={base:read('base.json'),free:read('free.json'),config:read('config.json')};
test('AG9 pays every line at its highest amount and all nine winning cells trigger tenfold',()=>{
 const board=[1,2,3,1,2,3,1,2,3],r=rules.evaluateLeopard(config,board);
 assert.equal(r.rawPayout,16);assert.equal(r.bonusMultiplier,10);assert.equal(r.totalBetMultiplier,32);
 assert.equal(rules.evaluateLeopard(config,Array(9).fill(7)).totalBetMultiplier,2500);
 const old=JSON.parse(fs.readFileSync(new URL('../../game_configs/AG4/paylines.json',import.meta.url)));
 assert.equal(tiger.evaluateFortuneTiger(old,board).bonusMultiplier,1);
 assert.equal(rules.evaluateLeopard(config,[7,0,0,7,0,0,7,0,0]).rawPayout,250);
});
test('AG9 feature generates and locks Wilds, ends on no addition, and pays once',()=>{
 const c=structuredClone(config);c.feature.fillProbability=1;c.feature.wildProbability=1;
 const r=tiger.runFortuneTigerRound(c,1000n,()=>0,'free');
 assert.deepEqual(r.frames.at(-1).board,Array(9).fill(7));assert.equal(r.winMinor,'2500000');
 assert.ok(r.frames.slice(0,-1).every(f=>f.winMinor==='0'));
 c.feature.fillProbability=0;const zero=tiger.runFortuneTigerRound(c,1000n,()=>0,'free');
 assert.equal(zero.endReason,'no_new_symbol');assert.equal(zero.frames.length,2);assert.equal(zero.winMinor,'0');
 assert.throws(()=>skeletons.inspectTigerSkeleton({target:1,stages:[[0,1],[0,7],[]]},config,'free'));
});
test('single-pass zero construction remains zero for ordinary and feature outcomes',()=>{
 for(let seed=0;seed<200;seed++)for(const mode of ['base','free']){
  const boards=rules.generateLeopardLoss(config,mode,seededRandom(seed));
  assert.ok(boards.every(b=>rules.evaluateLeopard(config,b).rawPayout===0));
  if(mode==='free'){assert.deepEqual(boards.at(-1),boards.at(-2));for(let i=1;i<boards.length;i++)boards[i-1].forEach((id,pos)=>{if(id)assert.equal(boards[i][pos],id);});}
 }
});
test('all published positive skeletons replay and fill without changing any award',()=>{
 const root=new URL('../../slots_service/testdata/deployments/2026-11-15-ag9/AG9/',import.meta.url);
 let count=0,wildFeature=0;
 for(const mode of ['base','free']){
  const library=JSON.parse(fs.readFileSync(new URL(mode+'-library/library.json',root)));
  assert.equal(library['0'],undefined);
  for(const [key,list] of Object.entries(library))for(const s of list){
   const before=skeletons.inspectTigerSkeleton(s,config,mode);assert.equal(before.key,key);
   const boards=rules.fillLeopardSkeleton(s,config,mode,seededRandom(count++));
   const result=rules.evaluateLeopard(config,boards.at(-1));assert.equal(result.rawPayout*result.bonusMultiplier,Number(key));
   if(mode==='free')wildFeature+=boards.at(-1).includes(7)?1:0;
  }
  assert.equal(skeletons.tigerCoverage({buckets:library},files[mode]).missing.length,0);
 }
 assert.equal(count,1787);assert.ok(wildFeature>0);
});
test('adopted reachable table preserves Lua conditional expectation and both probabilities',()=>{
 validateGameFiles(files);const old=read('free.lua-reference.json');
 const mean=rows=>rows.reduce((s,[m,w])=>s+m*w,0)/rows.reduce((s,[,w])=>s+w,0);
 assert.ok(Math.abs(mean(old)-mean(files.free))<1e-10);
 const sim=new RespinSimulation(files,1000000,1021);while(!sim.done)sim.step();
 assert.ok(Math.abs(sim.theoretical.totalRtp-.9685220120785671)<1e-8);
 assert.ok(Math.abs(sim.stats.rtp-sim.theoretical.totalRtp)<6*sim.theoretical.standardDeviation/1000);
 const again=new RespinSimulation(files,1000000,1021);while(!again.done)again.step();assert.deepEqual(sim.stats,again.stats);
 assert.ok(Math.abs(sim.stats.featureSpins/sim.stats.paidSpins-.015)<.001);
});
test('AG9 fixed payout, feature shape and raw multiplier limits are enforced',()=>{
 const c=structuredClone(config);c.symbols[0].payout=100;assert.throws(()=>validatePaylines(c));
 const f=structuredClone(files);f.config.parameters.lineCount=10;assert.throws(()=>validateGameFiles(f));
 f.config.parameters.lineCount=5;f.free.push([0,1]);assert.throws(()=>validateGameFiles(f));
});
