import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTypeScript as load} from './helpers/typescript.mjs';

const math=load(new URL('../src/domain/ag11Math.ts',import.meta.url));
const sim=load(new URL('../src/domain/ag11Simulation.ts',import.meta.url));
const settings=load(new URL('../src/domain/settings.ts',import.meta.url));
const model=load(new URL('../src/domain/model.ts',import.meta.url));
const root=new URL('../../game_configs/AG11/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const files=()=>({base:read('base.json'),free:read('free.json'),config:read('config.json')});
const table=rows=>model.parseWeightTable(JSON.stringify(rows));
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

test('AG11 Lua 1026 result tables are complete distributions and calculate natural/purchase RTP independently',()=>{
 const f=files(),board=read('board.json'),source=read('lua-1026-source.json');
 settings.validateGameFiles(f);math.validateAg11Board(board);
 assert.equal(f.base.length,459);assert.equal(f.base.some(([m])=>m===0),false);assert.equal(f.free.length,1140);assert.equal(f.config.parameters.purchaseFreeWeights.length,1121);
 assert.equal(source.rows.base,459);assert.equal(source.rows.baseOriginal,460);assert.equal(source.rows.free,1140);assert.equal(source.rows.purchaseFree,1121);
 const result=math.calculateAg11Rtp(table(f.base),table(f.free),f.config.parameters);
 near(result.baseMean,2.9812736209997);near(result.freeSessionMean,32.97097155282095);near(result.purchaseSessionMean,97.00562520239514);
 const expectedNatural=(1-f.config.parameters.freeSpinTriggerProbability)*f.config.parameters.baseSpinWinProbability*result.baseMean+f.config.parameters.freeSpinTriggerProbability*result.freeSessionMean;
 near(result.totalRtp,expectedNatural);near(result.purchaseRtp,.9700562520239514);
 const changed={...f.config.parameters,freeSpinTriggerProbability:.01};
 near(math.calculateAg11Rtp(table(f.base),table(f.free),changed).totalRtp,.99*f.config.parameters.baseSpinWinProbability*2.9812736209997+.01*32.97097155282095);
});

test('natural and 100x purchase simulations sample the same complete-result tables as theory',()=>{
 const f=files(),p=f.config.parameters,base=table(f.base),free=table(f.free);
 for(const mode of ['normal','purchase']){
  const a=new sim.Ag11Simulator(base,free,p,mode,1026),b=new sim.Ag11Simulator(base,free,p,mode,1026);
  for(let i=0;i<250000;i++){a.step();b.step();}
  assert.deepEqual(a.result(),b.result());
  const theory=math.calculateAg11Rtp(base,free,p),expected=mode==='normal'?theory.totalRtp:theory.purchaseRtp;
  assert.ok(Math.abs(a.result().totalRtp-expected)<6*a.result().standardError);
 }
});

test('1.25x Lua freeMode=2 uses independent double tables, trigger rate and actual bet divisor',()=>{
 const f=files(),p=f.config.parameters,d=p.bet125;
 settings.validateGameFiles(f);
 assert.equal(d.betMultiplier,1.25);assert.equal(d.baseWeights.length,459);assert.equal(d.freeWeights.length,1141);
 assert.equal(d.baseWeights.some(([m])=>m===0),false);assert.equal(d.freeWeights.some(([m])=>m===0),false);
 const result=math.calculateAg11Rtp(table(f.base),table(f.free),p),base=table(d.baseWeights),free=table(d.freeWeights);
 near(result.bet125BaseMean,base.mean);near(result.bet125FreeSessionMean,free.mean);
 const expectedBase=(1-d.freeSpinTriggerProbability)*d.baseSpinWinProbability*base.mean/d.betMultiplier;
 const expectedFree=d.freeSpinTriggerProbability*free.mean/d.betMultiplier;
 near(result.bet125BaseRtp,expectedBase);near(result.bet125FreeRtp,expectedFree);near(result.bet125Rtp,expectedBase+expectedFree);
 const s=new sim.Ag11Simulator(table(f.base),table(f.free),p,'bet125',1026);
 for(let i=0;i<250000;i++)s.step();
 assert.ok(Math.abs(s.result().totalRtp-result.bet125Rtp)<6*s.result().standardError);
 assert.equal(s.result().purchaseRtp,0);assert.ok(s.result().triggers>0);
});

test('free skeleton state accumulates only newly observed multipliers across the complete session',()=>{
 const p=files().config.parameters,spins=[];let cumulative=0,total=3;
 spins.push({triggerSpin:true,boards:[Array(30).fill(1)],baseMultiplier:3,newMultiplier:0,cumulativeMultiplier:0,retriggerSpins:0,payout:3});
 for(let i=0;i<15;i++){
  const added=i===0?2:i===1?3:i===2?10:0;cumulative+=added;
  const base=i<3?1:0,payout=base*(cumulative||1);total+=payout;
  spins.push({triggerSpin:false,boards:[Array(30).fill(0)],baseMultiplier:base,newMultiplier:added,cumulativeMultiplier:cumulative,retriggerSpins:0,payout});
 }
 const skeleton={version:1,format:'ag11-free-session-v1',mode:'free',initialSpins:15,spins,totalPayout:total,partial:false};
 assert.equal(spins[1].cumulativeMultiplier,2);assert.equal(spins[2].cumulativeMultiplier,5);assert.equal(spins[3].cumulativeMultiplier,15);
 assert.doesNotThrow(()=>math.validateAg11FreeSkeleton(skeleton,p,total));
 const invalid=structuredClone(skeleton);invalid.spins[2].cumulativeMultiplier=7;
 assert.throws(()=>math.validateAg11FreeSkeleton(invalid,p));
});
