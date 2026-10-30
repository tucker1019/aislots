import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = text => ts.transpile(text, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const modelUrl = url(compile(readFileSync(new URL('../src/domain/model.ts', import.meta.url), 'utf8')));
const model = await import(modelUrl);
const simCode = compile(readFileSync(new URL('../src/domain/simulation.ts', import.meta.url), 'utf8')).replace("from './model'", `from '${modelUrl}'`);
const { Simulator, createTieredBaseSampler, createAliasSampler, seededRandom, summarizeSimulation, simulationStrategyStages } = await import(url(simCode));
const parameters = { lineCount: 20, baseSpinWinProbability: 1, freeSpinWinProbability: 1, freeSpinTriggerProbability: 0, freeSpinsPerTrigger: 1 };
const request = { baseRows: [[5,1]], freeRows: [[10,1]], parameters, paidSpins: 100, seed: 42 };
function close(a,b,tolerance=1e-10) { assert.ok(Math.abs(a-b) <= tolerance, `${a} != ${b}`); }
function run(config, budget=4096) { const s = new Simulator(config); while (!s.done) s.step(budget); return s.stats; }
test('payout divided by lines exactly once and deterministic variance is zero', () => { const s=run(request); const r=summarizeSimulation(s); close(r.totalRtp,0.25); close(r.totalVariance,0); close(r.baseAverageWinMultiplier,0.25); assert.equal(s.freeSpins,0); });
test('nonwinning base can trigger free; final free spin can retrigger; only complete sessions commit', () => {
 const draws=[0.9,0.1, 0.2,0.5,0.1, 0.2,0.5,0.9];
 const s = new Simulator({...request, paidSpins:1, parameters:{...parameters,baseSpinWinProbability:0,freeSpinTriggerProbability:0.25}},()=>{assert.ok(draws.length);return draws.shift();});
 s.step(1); assert.equal(s.stats.completedPaidSpins,0);
 s.step(1); assert.equal(s.stats.completedPaidSpins,0);
 s.step(1); assert.equal(s.done,true); assert.equal(s.stats.freeSpins,2); assert.equal(s.stats.freeTriggers,1); close(s.stats.freePayout,1); assert.equal(s.stats.freeWins,2); assert.equal(draws.length,0);
});
test('zero-weight outcomes never sampled and decimal weights preserved', () => {
 const sample=createAliasSampler([[999,0],[2,0.5],[6,1.5]],2,2);
 let mean=0;
 for(let i=0;i<12000;i++){const v=sample(()=>(i+0.5)/12000);assert.ok(v===1||v===3);mean+=v;}
 close(mean/12000,2.5);
});
test('fixed seed is reproducible across batch boundaries', () => {
 const config={...request,baseRows:[[0,1],[5,2],[50,1]],parameters:{...parameters,baseSpinWinProbability:0.6,freeSpinTriggerProbability:0.1,freeSpinsPerTrigger:3},paidSpins:10000};
 assert.deepEqual(run(config,1),run(config,8192));
 const a=seededRandom(0),b=seededRandom(0);for(let i=0;i<100;i++){const x=a();assert.equal(x,b());assert.ok(x>=0&&x<1);}
});
test('no wins and a single sample yield undefined conditional metrics', () => {
 const s=run({...request,paidSpins:1,parameters:{...parameters,baseSpinWinProbability:0}});
 const r=summarizeSimulation(s);close(r.totalRtp,0);assert.equal(r.totalVariance,null);assert.equal(r.baseAverageWinMultiplier,null);assert.equal(r.overallAverageWinMultiplier,null);assert.equal(r.freePositiveProbability,null);
});
test('invalid simulation sizes, seeds and divergent free chains rejected',()=>{
 for(const paidSpins of [0,1.5,NaN,1_000_000_001]) assert.throws(()=>new Simulator({...request,paidSpins}));
 for(const seed of [-1,1.5,NaN,4294967296]) assert.throws(()=>new Simulator({...request,seed}));
 assert.throws(()=>new Simulator({...request,parameters:{...parameters,freeSpinTriggerProbability:1}}));
});
test('seeded random simulation agrees with independent theoretical moments',()=>{
 const config={...request,baseRows:[[0,1],[5,2],[30,1]],freeRows:[[0,1],[10,2],[50,1]],paidSpins:500000,parameters:{...parameters,baseSpinWinProbability:0.65,freeSpinWinProbability:0.7,freeSpinTriggerProbability:0.08,freeSpinsPerTrigger:3}};
 const t=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters);
 const r=summarizeSimulation(run(config));
 close(r.totalRtp,t.totalRtp,6*Math.sqrt(t.totalVariance/config.paidSpins));
 close(r.totalVariance,t.totalVariance,t.totalVariance*0.03);
 close(r.basePositiveProbability,t.basePositiveProbability,0.004);
 close(r.freePositiveProbability,t.freePositiveProbability,0.004);
 close(r.freeSessionSpins,t.freeSessionSpins,0.06);
});

test('ten million paid spins with production-sized 600/350-row fixtures', () => {
 const config = { paidSpins: 10_000_000, seed: 20261019, baseRows: JSON.parse(readFileSync(new URL('../data/base.json', import.meta.url),'utf8')), freeRows: JSON.parse(readFileSync(new URL('../data/free.json', import.meta.url),'utf8')), parameters: { lineCount: 20, baseSpinWinProbability: 0.39, freeSpinWinProbability: 0.41, freeSpinTriggerProbability: 0.01, freeSpinsPerTrigger: 8 } };
 const t=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters);
 const start=performance.now(); const stats=run(config); const r=summarizeSimulation(stats);
 assert.equal(stats.completedPaidSpins,10_000_000);
 close(r.totalRtp,t.totalRtp,6*Math.sqrt(t.totalVariance/config.paidSpins));
 close(r.baseRtp,t.baseRtp,6*Math.sqrt(t.baseVariance/config.paidSpins));
 close(r.freeRtp,t.freeRtp,6*Math.sqrt(t.freeContributionVariance/config.paidSpins));
 close(r.totalVariance,t.totalVariance,t.totalVariance*0.04);
 console.log(`10M acceptance fixture (not user settings): ${(performance.now()-start).toFixed(0)}ms; theoretical RTP ${t.totalRtp}; simulated RTP ${r.totalRtp}`);
});

test('maximum free payout sums retriggers and total maximum is a joint session maximum', () => {
 // Session 1: base = 5/20, two free spins = 2*10/20; session 2: base = 100/20, no free.
 const draws = [0.1,0,0.5,0.1, 0.1,0.5,0.1, 0.1,0.5,0.9, 0.1,0.75,0.5,0.9];
 const config = { ...request, baseRows: [[5,1],[100,1]], paidSpins:2, parameters: {...parameters, freeSpinTriggerProbability:0.25} };
 const sim = new Simulator(config, () => { assert.ok(draws.length); return draws.shift(); });
 sim.step(1); close(sim.stats.maximumFreeSessionPayout,0);
 sim.step(1); close(sim.stats.maximumFreeSessionPayout,0);
 sim.step(1); close(sim.stats.maximumFreeSessionPayout,1); close(sim.stats.maximumSessionPayout,1.25);
 sim.step(1); assert.equal(sim.done,true);
 close(sim.stats.maximumBasePayout,5); close(sim.stats.maximumFreeSessionPayout,1); close(sim.stats.maximumSessionPayout,5);
 assert.notEqual(sim.stats.maximumSessionPayout,sim.stats.maximumBasePayout+sim.stats.maximumFreeSessionPayout);
 assert.equal(draws.length,0);
});
test('no free triggers and no winning outcomes retain zero observed maxima', () => {
 const s=run({...request, parameters:{...parameters,baseSpinWinProbability:0}});
 close(s.maximumBasePayout,0);close(s.maximumFreeSessionPayout,0);close(s.maximumSessionPayout,0);assert.equal(s.freeTriggers,0);
});

test('initial and retrigger free awards draw independently and are counted by size', () => {
 // Base triggers N=1. Its first free spin retriggers N=3. Three more free spins then end.
 const draws = [0.9,0.05,0.1, 0.9,0.05,0.9, 0.9,0.9, 0.9,0.9, 0.9,0.9];
 const config = { ...request, paidSpins:1, parameters:{...parameters,baseSpinWinProbability:0,freeSpinWinProbability:0,freeSpinTriggerProbability:0.1,freeSpinAwardWeights:[[1,1],[3,1]]} };
 const simulator=new Simulator(config,()=>{assert.ok(draws.length);return draws.shift();});
 simulator.step(1);assert.equal(simulator.stats.completedPaidSpins,0);assert.deepEqual(simulator.stats.freeAwardCounts,{});
 while(!simulator.done)simulator.step(1);
 assert.equal(simulator.stats.freeSpins,4);
 assert.deepEqual(simulator.stats.initialFreeAwardCounts,{'1':1});
 assert.deepEqual(simulator.stats.retriggerFreeAwardCounts,{'3':1});
 assert.deepEqual(simulator.stats.freeAwardCounts,{'1':1,'3':1});
 assert.equal(draws.length,0);
});
test('8/10/12 weighted grants agree with theoretical RTP, variance and draw frequencies', () => {
 const config={...request,paidSpins:1_000_000,baseRows:[[1,3],[50,1]],freeRows:[[2,3],[100,1]],parameters:{...parameters,baseSpinWinProbability:0.39,freeSpinWinProbability:0.41,freeSpinTriggerProbability:0.02,freeSpinAwardWeights:[[8,70],[10,20],[12,10]]}};
 const theory=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters);
 const stats=run(config),result=summarizeSimulation(stats);
 close(result.totalRtp,theory.totalRtp,6*Math.sqrt(theory.totalVariance/config.paidSpins));
 close(result.totalVariance,theory.totalVariance,theory.totalVariance*0.04);
 const draws=Object.values(stats.freeAwardCounts).reduce((a,b)=>a+b,0);
 for(const [n,weight] of [[8,70],[10,20],[12,10]])close(stats.freeAwardCounts[n]/draws,weight/100,0.015);
 assert.equal(Object.values(stats.initialFreeAwardCounts).reduce((a,b)=>a+b,0),stats.freeTriggers);
 assert.equal(Object.entries(stats.freeAwardCounts).reduce((sum,[size,count])=>sum+Number(size)*count,0),stats.freeSpins);
});
test('zero-weight award sizes are not sampled and awards are not divided by lines', () => {
 const config={...request,paidSpins:10000,parameters:{...parameters,lineCount:50,freeSpinTriggerProbability:0.02,freeSpinAwardWeights:[[8,1],[1000,0]]}};
 const stats=run(config);assert.ok(stats.freeTriggers>0);assert.deepEqual(Object.keys(stats.freeAwardCounts),['8']);
 assert.equal(stats.freeSpins,stats.freeAwardCounts['8']*8);
});
test('random awards remain repeatable across simulation batches', () => {
 const config={...request,paidSpins:10000,parameters:{...parameters,freeSpinTriggerProbability:0.02,freeSpinAwardWeights:[[8,7],[10,2],[12,1]]}};
 assert.deepEqual(run(config,1),run(config,16384));
});

test('guarantee with retriggers and zero rows matches analytic RTP and variance', () => {
 const config={...request,paidSpins:300000,freeRows:[[0,3],[20,1],[60,1]],parameters:{...parameters,baseSpinWinProbability:0,freeSpinWinProbability:0.25,freeSpinTriggerProbability:0.2,freeSpinAwardWeights:[[1,1],[2,1]],freeSpinGuaranteedWin:true}};
 const s=run(config), actual=summarizeSimulation(s);
 const expected=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters);
 assert.ok(s.freeWins>=s.freeTriggers);
 close(actual.totalRtp,expected.totalRtp,0.015);close(actual.totalVariance,expected.totalVariance,0.06);
});
test('zero natural win probability guarantees exactly one win per whole free session', () => {
 const s=run({...request,paidSpins:10000,freeRows:[[0,5],[20,1]],parameters:{...parameters,freeSpinWinProbability:0,freeSpinTriggerProbability:0.2,freeSpinsPerTrigger:2,freeSpinGuaranteedWin:true}});
 assert.equal(s.freeWins,s.freeTriggers);assert.equal(s.freePayout,s.freeTriggers);
});

test('ordinary win then free trigger extends win streak; free spins do not count',()=>{
 const draws=[0.1,0.5,0.9, 0.9,0.1, 0.9,0.9, 0.1,0.9];
 const config={...request,paidSpins:3,parameters:{...parameters,baseSpinWinProbability:0.4,freeSpinWinProbability:0,freeSpinTriggerProbability:0.2,winStreakRule:{enabled:true,start:1,probability:0,interval:1,step:0,cap:3}}};
 const sim=new Simulator(config,()=>{assert.ok(draws.length);return draws.shift();});while(!sim.done)sim.step(1);
 assert.equal(sim.stats.baseWins,1);assert.equal(sim.stats.freeTriggers,1);assert.equal(draws.length,0);
});
test('both streak strategies with random guaranteed free sessions match stationary theory',()=>{
 const config={...request,paidSpins:500000,baseRows:[[0,1],[10,1],[30,1]],freeRows:[[0,1],[20,1],[60,1]],parameters:{...parameters,baseSpinWinProbability:0.4,freeSpinWinProbability:0.3,freeSpinTriggerProbability:0.1,freeSpinAwardWeights:[[1,1],[3,1]],freeSpinGuaranteedWin:true,lossStreakRule:{enabled:true,start:3,probability:0.6,interval:2,step:0.1,cap:7},winStreakRule:{enabled:true,start:2,probability:0.3,interval:1,step:0.1,cap:5}}};
 const expected=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters);
 const actual=summarizeSimulation(run(config));close(actual.baseRtp,expected.baseRtp,0.006);close(actual.freeRtp,expected.freeRtp,0.008);close(actual.totalVariance,expected.totalVariance,0.025);
});

test('streak maxima stay uncapped and stage counts use pre-spin state',()=>{
 const config={...request,paidSpins:10,parameters:{...parameters,baseSpinWinProbability:1,winStreakRule:{enabled:true,start:2,probability:1,interval:2,step:0,cap:5}}};
 const s=run(config,1);assert.equal(s.maximumWinningStreak,10);assert.equal(s.maximumLosingStreak,0);
 assert.deepEqual(s.strategyStageCounts,{base:2,'win:2':2,'win:4':1,'win:5':5});
 const stages=simulationStrategyStages(config.parameters);assert.deepEqual(stages.map(x=>x.key),['base','win:2','win:4','win:5']);
 assert.equal(Object.values(s.strategyStageCounts).reduce((a,b)=>a+b,0),s.completedPaidSpins);
});
test('maximum losing streak is tracked with strategies disabled',()=>{
 const s=run({...request,paidSpins:12,parameters:{...parameters,baseSpinWinProbability:0}});
 assert.equal(s.maximumLosingStreak,12);assert.equal(s.maximumWinningStreak,0);assert.deepEqual(s.strategyStageCounts,{base:12});
});
test('unfinished free sessions do not update streak maxima or stage counts',()=>{
 const draws=[0.9,0.1,0.9,0.9, 0.9,0.9];
 const sim=new Simulator({...request,paidSpins:2,parameters:{...parameters,baseSpinWinProbability:0,freeSpinWinProbability:0,freeSpinTriggerProbability:0.2}},()=>draws.shift());
 sim.step(1);assert.equal(sim.stats.maximumWinningStreak,0);assert.deepEqual(sim.stats.strategyStageCounts,{});
 sim.step(1);assert.equal(sim.stats.maximumWinningStreak,1);assert.equal(sim.stats.maximumLosingStreak,0);assert.deepEqual(sim.stats.strategyStageCounts,{base:1});
 sim.step(1);assert.equal(sim.stats.maximumWinningStreak,1);assert.equal(sim.stats.maximumLosingStreak,1);assert.deepEqual(sim.stats.strategyStageCounts,{base:2});
});
test('tier statistics and streak maxima survive worker-sized chunks deterministically',()=>{
 const config={...request,paidSpins:30000,parameters:{...parameters,baseSpinWinProbability:0.4,freeSpinWinProbability:0.3,freeSpinTriggerProbability:0.1,lossStreakRule:{enabled:true,start:2,probability:0.5,interval:2,step:0.1,cap:6},winStreakRule:{enabled:true,start:2,probability:0.3,interval:1,step:0.1,cap:4}}};
 const a=run(config,1),b=run(config,10000);assert.deepEqual(a,b);
 assert.equal(Object.values(a.strategyStageCounts).reduce((sum,n)=>sum+n,0),config.paidSpins);
 assert.ok(a.strategyStageCounts['loss:2']>0);assert.ok(a.strategyStageCounts['win:2']>0);
});

test('retrigger cap counts awards, excludes initial trigger and stops after budget',()=>{
 for(const cap of [0,1,3]){
 const config={...request,paidSpins:10,parameters:{...parameters,baseSpinWinProbability:0,freeSpinTriggerProbability:1,freeSpinsPerTrigger:2,freeRetriggerLimit:cap}};
 const s=run(config,1);assert.equal(s.freeSpins,10*2*(cap+1));assert.equal(s.freeTriggers,10);assert.equal(s.initialFreeAwardCounts['2'],10);assert.equal(s.retriggerFreeAwardCounts['2']??0,cap*10);assert.equal(s.maximumWinningStreak,10);
 }
});
test('limited retriggers, stochastic awards, streak strategies and guarantee match theory',()=>{
 const config={...request,paidSpins:300000,freeRows:[[0,2],[20,1],[60,1]],parameters:{...parameters,baseSpinWinProbability:0.4,freeSpinWinProbability:0.3,freeSpinTriggerProbability:0.45,freeSpinAwardWeights:[[1,1],[3,1]],freeRetriggerLimit:2,freeSpinGuaranteedWin:true,lossStreakRule:{enabled:true,start:2,probability:0.6,interval:1,step:0.1,cap:4}}};
 const r=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters);
 const stats=run(config),actual=summarizeSimulation(stats);close(actual.totalRtp,r.totalRtp,0.015);close(actual.totalVariance,r.totalVariance,0.07);close(actual.freeSessionSpins,r.freeSessionSpins,0.025);
 assert.ok(Object.values(stats.retriggerFreeAwardCounts).reduce((sum,n)=>sum+n,0)<=2*stats.freeTriggers);
});

test('paid free strategy composes with both ordinary strategies, guarantee and retrigger budget',()=>{
 const config={...request,paidSpins:500000,baseRows:[[0,1],[20,1],[40,1]],freeRows:[[0,1],[20,1],[40,1]],parameters:{...parameters,baseSpinWinProbability:0.4,freeSpinWinProbability:0.3,freeSpinTriggerProbability:0.1,freeSpinAwardWeights:[[1,1],[3,1]],freeRetriggerLimit:2,freeSpinGuaranteedWin:true,
 lossStreakRule:{enabled:true,start:2,probability:0.7,interval:1,step:0.1,cap:4},winStreakRule:{enabled:true,start:2,probability:0.2,interval:1,step:0.05,cap:4},freeTriggerRule:{enabled:true,start:2,probability:0.3,interval:2,step:0.1,cap:6,resetProbability:0.02}}};
 const r=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters),s=run(config),a=summarizeSimulation(s);
 close(a.totalRtp,r.totalRtp,0.015);close(a.baseRtp,r.baseRtp,0.008);close(a.effectiveFreeTriggerProbability,r.effectiveFreeTriggerProbability,0.003);close(a.totalVariance,r.totalVariance,0.06);
 assert.equal(Object.values(s.freeTriggerStageCounts).reduce((sum,n)=>sum+n,0),config.paidSpins);assert.ok(s.freeTriggerStageCounts.reset>0);assert.ok(s.freeTriggerStageCounts['miss:2']>0);
});
test('ordinary wins do not reset free misses, free internals retain base trigger probability',()=>{
 const draws=[0.1,0.5,0.9, 0.1,0.5,0.9, 0.1,0.5,0.9, 0.9,0.9, 0.1,0.5,0.9];
 const sim=new Simulator({...request,paidSpins:4,parameters:{...parameters,baseSpinWinProbability:1,freeSpinWinProbability:0,freeSpinTriggerProbability:0.1,freeTriggerRule:{enabled:true,start:2,probability:1,interval:1,step:0,cap:2,resetProbability:0}}},()=>{assert.ok(draws.length);return draws.shift();});
 while(!sim.done)sim.step(1);assert.equal(sim.stats.freeTriggers,1);assert.equal(sim.stats.freeSpins,1);assert.deepEqual(sim.stats.freeTriggerStageCounts,{base:2,'miss:2':1,reset:1});assert.equal(draws.length,0);
});

test('free waits count paid trigger spin, ignore free internals and retain censored tail',()=>{
 const draws=[];for(let paid=1;paid<=9;paid++){const hit=[3,5].includes(paid);draws.push(0.9,hit?0.1:0.9);if(hit)draws.push(0.9,0.9);}
 const sim=new Simulator({...request,paidSpins:9,parameters:{...parameters,baseSpinWinProbability:0,freeSpinWinProbability:0,freeSpinTriggerProbability:0.5,freeRetriggerLimit:0}},()=>{assert.ok(draws.length);return draws.shift();});
 while(!sim.done)sim.step(1);
 const s=sim.stats,r=summarizeSimulation(s);assert.deepEqual(s.freeWaitCounts,{'2':1,'3':1});assert.equal(s.freeWaitTotal,5);assert.equal(s.currentFreeWait,4);assert.equal(s.freeWaitTotal+s.currentFreeWait,s.completedPaidSpins);
 close(r.averageFreeWait,2.5);assert.equal(r.freeWaitP95,3);assert.equal(r.maximumCompletedFreeWait,3);assert.equal(r.observedLongestFreeWait,4);assert.equal(draws.length,0);
});
test('free waiting summaries handle no triggers and nearest-rank P95',()=>{
 const s=run({...request,paidSpins:20,parameters:{...parameters,baseSpinWinProbability:0}});
 const no=summarizeSimulation(s);assert.equal(no.averageFreeWait,null);assert.equal(no.freeWaitP95,null);assert.equal(no.observedLongestFreeWait,20);
 const r=summarizeSimulation({...s,freeTriggers:20,freeWaitCounts:{1:18,7:1,50:1},freeWaitTotal:75,maximumFreeWait:50,currentFreeWait:0});assert.equal(r.freeWaitP95,7);
});
test('constant trigger rate produces geometric wait distribution',()=>{
 const s=run({...request,paidSpins:300000,parameters:{...parameters,baseSpinWinProbability:0,freeSpinWinProbability:0,freeSpinTriggerProbability:0.25,freeRetriggerLimit:0}}),r=summarizeSimulation(s);
 close(r.averageFreeWait,4,0.05);assert.equal(r.freeWaitP95,11);assert.equal(s.freeWaitTotal+s.currentFreeWait,s.completedPaidSpins);
 assert.equal(Object.values(s.freeWaitCounts).reduce((sum,n)=>sum+n,0),s.freeTriggers);
});
test('wait statistics only commit after complete free session and are independent of strategy caps',()=>{
 const draws=[0.9,0.1,0.9,0.9];const sim=new Simulator({...request,paidSpins:1,parameters:{...parameters,baseSpinWinProbability:0,freeSpinWinProbability:0,freeSpinTriggerProbability:0.5,freeRetriggerLimit:0}},()=>draws.shift());
 sim.step(1);assert.deepEqual(sim.stats.freeWaitCounts,{});assert.equal(sim.stats.freeWaitTotal,0);sim.step(1);assert.deepEqual(sim.stats.freeWaitCounts,{1:1});assert.equal(sim.stats.currentFreeWait,0);
});

test('two-stage sampler preserves interval and internal distributions before and after compensation',()=>{
 const t=model.parseWeightTable('[[4,2],[16,1],[40,1],[400,1]]'),sample=createTieredBaseSampler(t,20),random=seededRandom(42);
 for(const compensate of [false,true]){
  const counts=new Map(),n=200000;for(let i=0;i<n;i++){const a=sample(random,0.8,0.4,compensate);counts.set(a.payout,(counts.get(a.payout)||0)+1);}
  const first=(counts.get(0.2)||0)+(counts.get(0.8)||0),expected=model.createBasePrizePlan(t,20).profile(0.8,0.4,compensate);
  close(first/n,expected.firstProbability,0.005);close(counts.get(0.2)/first,2/3,0.005);
 }
});
test('compensated payout moments match simulation with zero multipliers and every other strategy',()=>{
 const config={...request,paidSpins:600000,baseRows:[[0,1],[4,2],[16,1],[40,1],[400,1]],freeRows:[[0,1],[20,1],[60,1]],parameters:{...parameters,baseSpinWinProbability:0.4,freeSpinWinProbability:0.3,freeSpinTriggerProbability:0.1,freeSpinAwardWeights:[[1,1],[3,1]],freeRetriggerLimit:2,freeSpinGuaranteedWin:true,lossStreakRtpCompensation:true,
 lossStreakRule:{enabled:true,start:2,probability:0.6,interval:1,step:0.1,cap:4},winStreakRule:{enabled:true,start:2,probability:0.3,interval:1,step:0.1,cap:4},freeTriggerRule:{enabled:true,start:3,probability:0.3,interval:1,step:0.1,cap:6,resetProbability:0.02}}};
 const r=model.calculateModel(model.parseWeightTable(JSON.stringify(config.baseRows)),model.parseWeightTable(JSON.stringify(config.freeRows)),config.parameters),s=run(config),a=summarizeSimulation(s);
 close(a.totalRtp,r.totalRtp,0.03);close(a.baseRtp,r.baseRtp,0.025);close(a.totalVariance,r.totalVariance,0.5);close(a.basePositiveProbability,r.basePositiveProbability,0.004);
 assert.ok(s.basePrizeTierCounts[0]>0);assert.ok(s.basePrizeTierCounts[1]>0);
});

test('free payout probability is locked across retriggers and trigger rate resets to base',()=>{
 const draws=[.9,.9, .9,.9, .9,.9, .2,.05, .2,.9, .9,.9];
 const sim=new Simulator({...request,paidSpins:4,parameters:{...parameters,baseSpinWinProbability:0,freeSpinWinProbability:0.8,freeSpinTriggerProbability:0.1,freeTriggerRtpCompensation:true,freeTriggerRule:{enabled:true,start:2,probability:1,interval:1,step:0,cap:2,resetProbability:0}}},()=>{assert.ok(draws.length);return draws.shift();});
 while(!sim.done)sim.step(1);assert.equal(sim.stats.freeTriggers,1);assert.equal(sim.stats.freeSpins,2);assert.equal(sim.stats.freeWins,0);assert.deepEqual(sim.stats.freeTriggerStageCounts,{base:3,'miss:2':1});assert.equal(draws.length,0);
});
test('both RTP compensations compose with ordinary cooling, random guarantee and finite retriggers',()=>{
 const config={...request,paidSpins:700000,baseRows:[[0,1],[4,2],[16,1],[40,1],[400,1]],freeRows:[[0,1],[20,1],[60,1]],parameters:{...parameters,baseSpinWinProbability:0.4,freeSpinWinProbability:0.7,freeSpinTriggerProbability:0.1,freeSpinAwardWeights:[[2,1],[4,1]],freeRetriggerLimit:2,freeSpinGuaranteedWin:true,lossStreakRtpCompensation:true,freeTriggerRtpCompensation:true,
 lossStreakRule:{enabled:true,start:2,probability:0.6,interval:1,step:0.1,cap:4},winStreakRule:{enabled:true,start:2,probability:0.3,interval:1,step:0.1,cap:4},freeTriggerRule:{enabled:true,start:2,probability:0.12,interval:2,step:0.02,cap:6}}};
 const base=model.parseWeightTable(JSON.stringify(config.baseRows)),free=model.parseWeightTable(JSON.stringify(config.freeRows)),r=model.calculateModel(base,free,config.parameters),s=run(config),a=summarizeSimulation(s);
 const baseline=model.calculateModel(base,free,{...config.parameters,freeTriggerRule:undefined});close(r.freeRtp,baseline.freeRtp);
 close(a.freeRtp,r.freeRtp,0.015);close(a.totalRtp,r.totalRtp,0.035);close(a.totalVariance,r.totalVariance,0.5);close(a.freePositiveProbability,r.freePositiveProbability,0.004);close(a.freeAverageWinMultiplier,r.freeAverageWinMultiplier,0.015);
});
