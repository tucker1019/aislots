import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpile(readFileSync(new URL('../src/domain/model.ts', import.meta.url), 'utf8'), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const { parseWeightTable: parse, calculateModel: calculate, payoutTableForDisplay, classifyBasePrizes, createBasePrizePlan, createFreeTriggerCompensationPlan } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const table = parse('[[1,1]]');
const defaults = { lineCount: 1, baseSpinWinProbability: 1, freeSpinWinProbability: 1, freeSpinTriggerProbability: 0, freeSpinsPerTrigger: 1 };
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-10 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`); }
test('deterministic base payout without free trigger', () => { const r = calculate(table, table, defaults); close(r.totalRtp, 1); close(r.totalVariance, 0); close(r.freeRtp, 0); });
test('single added spin gives geometric session and total variance', () => {
  const r = calculate(table, table, { ...defaults, baseSpinWinProbability: 0, freeSpinTriggerProbability: 0.25 });
  close(r.freeSessionSpins, 4 / 3); close(r.freeSessionSpinsVariance, 4 / 9); close(r.totalRtp, 1 / 3); close(r.totalVariance, 4 / 9);
});
test('multiple offspring: exact two-spin branching moments', () => {
  const r = calculate(table, table, { ...defaults, freeSpinTriggerProbability: 0.25, freeSpinsPerTrigger: 2 });
  close(r.freeSessionSpins, 4); close(r.freeSessionSpinsVariance, 12); close(r.freeRtp, 1); close(r.totalRtp, 2); close(r.totalVariance, 6);
});
test('no payout from free spins gives no free payout variance', () => { const r = calculate(table, table, { ...defaults, baseSpinWinProbability: 0.5, freeSpinWinProbability: 0, freeSpinTriggerProbability: 0.1, freeSpinsPerTrigger: 5 }); close(r.totalRtp, 0.5); close(r.totalVariance, 0.25); });
test('weighted payout moments include non-win probability', () => { const r = calculate(parse('[[1,1],[3,1]]'), table, { ...defaults, baseSpinWinProbability: 0.5 }); close(r.baseRtp, 1); close(r.baseVariance, 1.5); });
test('scaling weights does not change moments; zero-weight maximum excluded', () => { const a = parse('[[2,1],[4,3],[100,0]]'); const b = parse('[[2,100],[4,300]]'); close(a.mean, b.mean); close(a.secondMoment, b.secondMoment); close(a.maximum, 4); });
test('invalid tables rejected', () => { for (const s of ['{}','[]','[[1,0]]','[[1,-1]]','[["1",1]]','[[1,1,1]]','[[1e300,1e300]]','{{1,2}}']) assert.throws(() => parse(s)); });
test('critical and supercritical free sessions rejected', () => { for (const q of [0.1, 0.2]) assert.throws(() => calculate(table, table, { ...defaults, freeSpinTriggerProbability: q, freeSpinsPerTrigger: 10 })); });
test('invalid parameters rejected', () => { for (const overrides of [{ baseSpinWinProbability: NaN }, { freeSpinWinProbability: -0.1 }, { freeSpinTriggerProbability: 1.1 }, { freeSpinsPerTrigger: 0 }, { freeSpinsPerTrigger: 1.5 }]) assert.throws(() => calculate(table, table, { ...defaults, ...overrides })); });

test('5x table payout on 20 lines pays 0.25 per unit total bet', () => { const r = calculate(parse('[[5,1]]'), table, { ...defaults, lineCount: 20 }); close(r.baseRtp, 0.25); close(r.baseVariance, 0); });
test('line count scales both modes and all payout variances, preserving spin counts', () => {
  const p = { ...defaults, baseSpinWinProbability: 0.4, freeSpinWinProbability: 0.6, freeSpinTriggerProbability: 0.03, freeSpinsPerTrigger: 8 };
  const a = calculate(parse('[[1,2],[10,1]]'), parse('[[2,1],[20,1]]'), p);
  const b = calculate(parse('[[1,2],[10,1]]'), parse('[[2,1],[20,1]]'), { ...p, lineCount: 20 });
  for (const key of ['baseRtp','freeRtp','totalRtp','freeSpinMean','freeSessionMean','standardDeviation']) close(b[key], a[key] / 20);
  for (const key of ['baseVariance','freeSpinVariance','freeSessionVariance','freeContributionVariance','totalVariance']) close(b[key], a[key] / 400);
  for (const key of ['freeSessionSpins','freeSessionSpinsVariance','expectedFreeSpinsPerPaidSpin','reproduction']) close(b[key], a[key]);
});
test('invalid line counts rejected', () => { for (const lineCount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => calculate(table, table, { ...defaults, lineCount })); });

test('all displayed multipliers normalize once, retaining source data', () => {
 const source = parse('[[1,2],[5,3],[20,1]]');
 for (const lineCount of [1,20,50]) {
  const display = payoutTableForDisplay(source, lineCount);
  close(display.mean, source.mean / lineCount);
  close(display.maximum, source.maximum / lineCount);
  display.rows.forEach(([multiplier, weight], i) => { close(multiplier, source.rows[i][0] / lineCount); close(weight, source.rows[i][1]); });
 }
 assert.deepEqual(source.rows, [[1,2],[5,3],[20,1]]);
 assert.equal(payoutTableForDisplay(source, 0), null);
});

test('average wins exclude zero payouts and use total-bet multipliers', () => {
 const base = parse('[[0,2],[5,1],[15,1]]');
 const r = calculate(base, parse('[[0,1],[20,1]]'), { ...defaults, lineCount: 20, baseSpinWinProbability: 0.4, freeSpinWinProbability: 0.6, freeSpinTriggerProbability: 0.1, freeSpinsPerTrigger: 2 });
 close(r.basePositiveProbability, 0.2); close(r.freePositiveProbability, 0.3);
 close(r.baseAverageWinMultiplier, 0.5); close(r.freeAverageWinMultiplier, 1);
 close(r.expectedWinningSpinsPerPaidSpin, 0.275);
 close(r.overallAverageWinMultiplier, 0.175 / 0.275);
});
test('impossible wins are undefined, not zero or infinite', () => {
 const r = calculate(parse('[[0,1]]'), table, { ...defaults, freeSpinWinProbability: 0 });
 assert.equal(r.baseAverageWinMultiplier, null); assert.equal(r.freeAverageWinMultiplier, null); assert.equal(r.overallAverageWinMultiplier, null);
 close(r.expectedWinningSpinsPerPaidSpin, 0);
});
test('free-only winnings set the combined conditional mean', () => {
 const r = calculate(table, parse('[[10,1]]'), { ...defaults, lineCount: 20, baseSpinWinProbability: 0, freeSpinTriggerProbability: 0.1 });
 assert.equal(r.baseAverageWinMultiplier, null); close(r.overallAverageWinMultiplier, 0.5);
});

test('random initial free award and branching variance use both moments', () => {
 // N is 1 or 3 equally likely; mean 2, variance 1; q = 1/4.
 const r = calculate(table, table, { ...defaults, baseSpinWinProbability: 0, freeSpinTriggerProbability: 0.25, freeSpinAwardWeights: [[1,1],[3,1]] });
 close(r.freeSpinsPerTriggerMean,2); close(r.freeSpinsPerTriggerVariance,1);
 close(r.freeSessionSpins,4); close(r.freeSessionSpinsVariance,20);
 close(r.freeRtp,1); close(r.totalVariance,8);
});
test('random grant sizes preserve the original single-outcome case', () => {
 const p = { ...defaults, freeSpinTriggerProbability: 0.05, freeSpinsPerTrigger: 8 };
 assert.deepEqual(calculate(table,table,p),calculate(table,table,{...p,freeSpinAwardWeights:[[8,70]]}));
});
test('same mean award, higher award variance increases overall payout variance', () => {
 const p = { ...defaults, freeSpinTriggerProbability: 0.1 };
 const fixed=calculate(table,table,{...p,freeSpinAwardWeights:[[2,1]]});
 const variable=calculate(table,table,{...p,freeSpinAwardWeights:[[1,1],[3,1]]});
 close(fixed.totalRtp,variable.totalRtp);assert.ok(variable.totalVariance>fixed.totalVariance);
});
test('stability uses average award rather than maximum award', () => {
 assert.doesNotThrow(()=>calculate(table,table,{...defaults,freeSpinTriggerProbability:0.4,freeSpinAwardWeights:[[1,99],[10,1]]}));
 assert.throws(()=>calculate(table,table,{...defaults,freeSpinTriggerProbability:0.5,freeSpinAwardWeights:[[1,1],[3,1]]}));
});
test('free award table rejects invalid counts, weights and empty rows', () => {
 for(const rows of [[],[[0,1]],[[1.5,1]],[[8,-1]],[[8,0]],[[8,NaN]],[[Infinity,1]],[[8,1,2]]])assert.throws(()=>calculate(table,table,{...defaults,freeSpinAwardWeights:rows}));
});

test('guarantee replaces only all-zero sessions and adjusts both payout moments', () => {
 const free = parse('[[0,2],[2,1],[4,1]]');
 const p = {...defaults, freeSpinWinProbability:0, freeSpinTriggerProbability:0.1, freeSpinsPerTrigger:2, freeSpinGuaranteedWin:true};
 const r=calculate(table,free,p);
 close(r.freeSessionMean,3); close(r.freeSessionVariance,1); close(r.freeRtp,0.3);
 close(r.freePositiveProbability,1/r.freeSessionSpins);
 assert.throws(()=>calculate(table,parse('[[0,1]]'),p),/正倍率/);
});
test('guarantee with certain natural win adds nothing', () => {
 const p={...defaults,freeSpinTriggerProbability:0.1,freeSpinsPerTrigger:2};
 const before=calculate(table,table,p), after=calculate(table,table,{...p,freeSpinGuaranteedWin:true});
 close(after.totalRtp,before.totalRtp);close(after.totalVariance,before.totalVariance);
});
test('random guarantee exact moments for two fixed spins without retriggers', () => {
 const p={...defaults,freeSpinWinProbability:0.4,freeSpinTriggerProbability:0,freeSpinsPerTrigger:2,freeSpinGuaranteedWin:true};
 const r=calculate(table,table,p);
 // J=1: 1 + Bernoulli(.4); J=2: max(1, Binomial(2,.4)).
 close(r.freeGuaranteeProbability,(0.6+0.36)/2);
 close(r.freeSessionMean,1.28);close(r.freeSessionVariance,0.2016);
});
test('tiny positive hit probability remains numerically stable', () => {
 const r=calculate(table,table,{...defaults,freeSpinWinProbability:1e-14,freeSpinTriggerProbability:0.01,freeSpinsPerTrigger:8,freeSpinGuaranteedWin:true});
 close(r.freeSessionMean,1);close(r.freeSessionVariance,0);
});

test('streak strategy stationary RTP matches an independent state distribution', () => {
 const p={...defaults,baseSpinWinProbability:0.39,freeSpinTriggerProbability:0.1,freeSpinWinProbability:0.5,freeSpinsPerTrigger:2,
 lossStreakRule:{enabled:true,start:3,probability:0.6,interval:2,step:0.1,cap:7},winStreakRule:{enabled:true,start:2,probability:0.3,interval:1,step:0.05,cap:5}};
 const states=[0,...Array.from({length:7},(_,i)=>-i-1),...Array.from({length:5},(_,i)=>i+1)];
 function prob(s){const r=s<0?p.lossStreakRule:p.winStreakRule,k=Math.abs(s);return k<r.start?p.baseSpinWinProbability:Math.max(0,Math.min(1,r.probability+(s<0?1:-1)*Math.floor((Math.min(k,r.cap)-r.start)/r.interval)*r.step));}
 let mass=new Map([[0,1]]);
 for(let i=0;i<1000;i++){const next=new Map();for(const [s,v] of mass){const hit=1-(1-prob(s)*0.5)*0.9;for(const [target,w] of [[s>0?Math.min(s+1,5):1,hit],[s<0?Math.max(s-1,-7):-1,1-hit]])next.set(target,(next.get(target)||0)+v*w);}mass=next;}
 const expected=[...mass].reduce((sum,[s,v])=>sum+v*prob(s),0);
 const r=calculate(parse('[[0,1],[2,1]]'),table,p);close(r.effectiveBaseWinProbability,expected);close(r.baseRtp,expected);
 const plain=calculate(parse('[[0,1],[2,1]]'),table,{...p,lossStreakRule:undefined,winStreakRule:undefined});close(r.freeRtp,plain.freeRtp);
});
test('deterministic periodic strategy and absorbing tails have well-defined long-term RTP',()=>{
 const p={...defaults,baseSpinWinProbability:0.5,winStreakRule:{enabled:true,start:1,probability:0,interval:1,step:0,cap:1},lossStreakRule:{enabled:true,start:1,probability:1,interval:1,step:0,cap:1}};
 close(calculate(table,table,p).effectiveBaseWinProbability,0.5);
 close(calculate(table,table,{...p,winStreakRule:undefined}).effectiveBaseWinProbability,2/3);
 const both={...p,winStreakRule:{...p.winStreakRule,probability:1},lossStreakRule:{...p.lossStreakRule,probability:0}};
 // Direction validation intentionally excludes inverted increase/decrease settings.
 assert.throws(()=>calculate(table,table,both));
 assert.throws(()=>calculate(table,table,{...p,lossStreakRule:{...p.lossStreakRule,interval:0}}));
});

test('zero retrigger budget removes all offspring even at 100% trigger',()=>{
 const r=calculate(table,table,{...defaults,freeSpinTriggerProbability:1,freeSpinAwardWeights:[[2,1],[4,1]],freeRetriggerLimit:0});
 close(r.freeSessionSpins,3);close(r.freeSessionSpinsVariance,1);close(r.freeRtp,3);
});
test('finite budget supports supercritical probabilities with exact count moments',()=>{
 const r=calculate(table,table,{...defaults,freeSpinTriggerProbability:1,freeSpinAwardWeights:[[2,1],[4,1]],freeRetriggerLimit:2});
 close(r.freeSessionSpins,9);close(r.freeSessionSpinsVariance,3);close(r.freeRtp,9);
});
test('one allowed retrigger has analytic Bernoulli count moments',()=>{
 const r=calculate(table,table,{...defaults,freeSpinTriggerProbability:0.25,freeSpinsPerTrigger:2,freeRetriggerLimit:1});
 const hit=1-0.75**2;close(r.freeSessionSpins,2+2*hit);close(r.freeSessionSpinsVariance,4*hit*(1-hit));
});
test('limited free counts compose with random guarantee',()=>{
 const r=calculate(table,table,{...defaults,freeSpinWinProbability:0,freeSpinTriggerProbability:1,freeSpinAwardWeights:[[2,1],[4,1]],freeRetriggerLimit:2,freeSpinGuaranteedWin:true});
 close(r.freeSessionMean,1);close(r.freeSessionVariance,0);close(r.freePositiveProbability,1/9);
 for(const cap of [-1,1.2,101,NaN])assert.throws(()=>calculate(table,table,{...defaults,freeRetriggerLimit:cap}));
});

test('paid-only free trigger strategy has exact renewal rate and unchanged free internals',()=>{
 const p={...defaults,baseSpinWinProbability:0.4,freeSpinTriggerProbability:0.1,freeSpinsPerTrigger:1,freeTriggerRule:{enabled:true,start:2,probability:0.5,interval:1,step:0,cap:2,resetProbability:0}};
 const r=calculate(table,table,p);close(r.effectiveFreeTriggerProbability,0.25);close(r.effectiveBaseWinProbability,0.4);close(r.freeSessionSpins,1/0.9);close(r.freeRtp,0.25/0.9);
 assert.throws(()=>calculate(table,table,{...p,freeTriggerRule:{...p.freeTriggerRule,resetProbability:0.2}}));
});
test('periodic paid free trigger strategy converges with lazy joint transitions',()=>{
 const p={...defaults,baseSpinWinProbability:0,freeSpinTriggerProbability:0.1,freeSpinsPerTrigger:1,freeTriggerRule:{enabled:true,start:2,probability:1,interval:1,step:0,cap:2,resetProbability:0}};
 close(calculate(table,table,p).effectiveFreeTriggerProbability,1/3);
});

test('long free-trigger ramp with low reset probability remains solvable',()=>{
 const p={...defaults,baseSpinWinProbability:0.39,freeSpinWinProbability:0.52,freeSpinTriggerProbability:0.0065,freeSpinsPerTrigger:8,freeTriggerRule:{enabled:true,start:100,probability:0.0065,interval:10,step:0.003,cap:400,resetProbability:0.0005}};
 let survival=1,duration=0;
 for(let k=0;k<400;k++){duration+=survival;const q=k<100?0.0005:0.0065+Math.floor((k-100)/10)*0.003;survival*=1-q;}
 duration+=survival/(0.0065+30*0.003);
 close(calculate(table,table,p).effectiveFreeTriggerProbability,1/duration);
 const joint=calculate(table,table,{...p,lossStreakRule:{enabled:true,start:3,probability:0.5,interval:1,step:0.01,cap:12},winStreakRule:{enabled:true,start:2,probability:0.35,interval:1,step:0.02,cap:5}});
 close(joint.effectiveFreeTriggerProbability,1/duration);assert.ok(joint.effectiveBaseWinProbability>0 && joint.effectiveBaseWinProbability<1);
});

test('ordinary prize tiers divide by lines once and assign exact boundaries without overlap',()=>{
 const lines=20,values=[0,0.5,1,10,30,60,100,200,300];
 const t=parse(JSON.stringify(values.map(n=>[n*lines,1]))),tiers=classifyBasePrizes(t,lines);
 assert.deepEqual(tiers.map(t=>t.records),[2,1,1,1,1,1,2]);close(tiers.reduce((sum,t)=>sum+t.probability,0),1);
 close(tiers[0].averageMultiplier,0.25);close(tiers[6].averageMultiplier,250);
 assert.equal(tiers[6].maximum,null);assert.throws(()=>classifyBasePrizes(t,0));
});
test('empty prize tiers remain visible and zero-weight records do not create probability',()=>{
 const tiers=classifyBasePrizes(parse('[[10,1],[4000,0]]'),20);
 assert.equal(tiers.length,7);close(tiers[0].probability,1);assert.equal(tiers[6].averageMultiplier,null);assert.equal(tiers[6].records,1);
});

test('first-tier compensation keeps interval internal weights unchanged and preserves Base RTP',()=>{
 const table=parse('[[4,2],[16,1],[40,1],[400,1]]'),before=JSON.stringify(table.rows),plan=createBasePrizePlan(table,20);
 const r=plan.profile(0.8,0.4,true);close(r.mean,0.4*table.mean/20);assert.ok(r.firstProbability>3/5);assert.ok(r.firstTotalWeight>3);assert.equal(JSON.stringify(table.rows),before);
 close(plan.tiers[0].rows[0][1]/plan.tiers[0].rows[1][1],2);
 const p={...defaults,lineCount:20,baseSpinWinProbability:0.4,lossStreakRtpCompensation:true,lossStreakRule:{enabled:true,start:2,probability:0.6,interval:1,step:0.1,cap:4}};
 close(calculate(table,table,p).baseRtp,0.4*table.mean/20);
});
test('compensation supports first-only endpoint and rejects impossible target mean',()=>{
 const t=parse('[[10,1],[40,1]]'),plan=createBasePrizePlan(t,20);
 const r=plan.profile(0.625,0.25,true);close(r.firstProbability,1);assert.equal(r.firstTotalWeight,null);close(r.mean,0.3125);
 assert.throws(()=>plan.profile(1,0.25,true),/无法维持/);assert.throws(()=>createBasePrizePlan(parse('[[40,1],[80,1]]'),20).profile(0.8,0.4,true),/正权重/);
});

test('free trigger compensation keeps Free RTP constant and removes the old reset probability',()=>{
 const p={...defaults,baseSpinWinProbability:0.4,freeSpinWinProbability:0.6,freeSpinTriggerProbability:0.1,freeSpinsPerTrigger:2,freeTriggerRtpCompensation:true,freeTriggerRule:{enabled:true,start:2,probability:0.2,interval:1,step:0.1,cap:4,resetProbability:0}};
 const r=calculate(table,table,p),baseline=calculate(table,table,{...p,freeTriggerRule:undefined});close(r.freeRtp,baseline.freeRtp);assert.ok(r.effectiveFreeTriggerProbability>0.1);
 const plan=createFreeTriggerCompensationPlan(table,p);close(plan.at(0.2).freeWinProbability,0.3);close(plan.at(0.4).freeWinProbability,0.15);
 for(const row of r.freeCompensationRows)close(row.freeRtp,baseline.freeRtp);
});
test('free compensation includes random guaranteed win, random counts and finite retriggers',()=>{
 const free=parse('[[0,1],[1,1],[3,1]]'),p={...defaults,baseSpinWinProbability:0.4,freeSpinWinProbability:0.7,freeSpinTriggerProbability:0.1,freeSpinAwardWeights:[[2,1],[4,1]],freeRetriggerLimit:2,freeSpinGuaranteedWin:true,freeTriggerRtpCompensation:true,freeTriggerRule:{enabled:true,start:2,probability:0.12,interval:2,step:0.02,cap:6}};
 const plan=createFreeTriggerCompensationPlan(free,p),r=calculate(table,free,p);close(r.freeRtp,plan.target);
 for(const q of [0.12,0.14,0.16]){const adjusted=plan.at(q);close(q*adjusted.sessionMean,plan.target);assert.ok(adjusted.freeWinProbability<p.freeSpinWinProbability);}
 assert.throws(()=>calculate(table,free,{...p,freeTriggerRule:{...p.freeTriggerRule,probability:1}}),/最低 EV/);
});
test('one guaranteed spin has an EV floor independent of natural win probability',()=>{
 const p={...defaults,freeSpinWinProbability:0.5,freeSpinTriggerProbability:0.1,freeSpinsPerTrigger:1,freeRetriggerLimit:0,freeSpinGuaranteedWin:true,freeTriggerRtpCompensation:true,freeTriggerRule:{enabled:true,start:2,probability:0.2,interval:1,step:0,cap:2}};
 assert.throws(()=>calculate(table,table,p),/无法保持 Free RTP/);
});
