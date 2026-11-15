import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTypeScript as load} from './helpers/typescript.mjs';
const math=load(new URL('../src/domain/dragonMath.ts',import.meta.url)),board=load(new URL('../src/domain/fortuneDragon.ts',import.meta.url)),{DragonSimulator}=load(new URL('../src/domain/dragonSimulation.ts',import.meta.url)),{seededRandom}=load(new URL('../src/domain/simulation.ts',import.meta.url)),settings=load(new URL('../src/domain/settings.ts',import.meta.url));
const read=n=>JSON.parse(fs.readFileSync(new URL('../../game_configs/AG8/'+n+'.json',import.meta.url))),files=()=>({base:read('base'),free:read('free'),config:read('config')}),near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('1048 numerical tables retain four independent probability profiles',()=>{
 const f=files(),source=read('lua-1048-source');settings.validateGameFiles(f);assert.equal(f.base.length,194);assert.equal(f.free.length,194);for(const [rows,name] of [[f.base,'rates_normal'],[f.free,'rates_free'],[f.config.dragon.boost.base,'rates_5x_normal'],[f.config.dragon.boost.free,'rates_5x_free']])assert.deepEqual(rows,source.sourceTables[name].filter(([m])=>m>0));near(f.config.parameters.baseSpinWinProbability,.22);near(f.config.parameters.freeSpinWinProbability,.28);assert.equal(f.config.dragon.boost.baseWinProbability,1);assert.equal(f.config.dragon.boost.freeWinProbability,1);
 for(const key of ['dragon','parameters']){const corrupt=structuredClone(f);corrupt.config[key].unknown=1;assert.throws(()=>settings.validateGameFiles(corrupt));}
 const corrupt=structuredClone(f);delete corrupt.config.dragon.boost;assert.throws(()=>math.validateDragonFiles(corrupt));
});
test('five screenshot lines, Wild substitution and no invented full-board multiplier',()=>{
 const c=read('paylines');for(let i=0;i<5;i++){const b=Array(9).fill(0);c.lines[i].forEach(p=>b[p-1]=1);const e=board.evaluateDragon(c,b);assert.equal(e.rawPayout,2);assert.equal(e.wins.length,1);assert.equal(e.wins[0].line,i+1);}
 assert.equal(board.evaluateDragon(c,Array(9).fill(7)).rawPayout,500);assert.equal(board.evaluateDragon(c,Array(9).fill(6)).rawPayout,250);
 for(const line of [[7,7,5],[7,5,7],[5,7,7]]){const b=Array(9).fill(0);[1,4,7].forEach((p,i)=>b[p]=line[i]);assert.equal(board.evaluateDragon(c,b).rawPayout,25);}
});
test('single-pass loss and fill consume exactly one draw per hole',()=>{
 const c=read('paylines');for(const mode of ['base','free'])for(const n of [0,.4,.99]){let calls=0;const b=board.generateDragonLoss(c,mode,()=>{calls++;return n;});assert.equal(calls,9);assert.equal(board.evaluateDragon(c,b).rawPayout,0);}
 let calls=0;assert.throws(()=>board.fillDragonSkeleton({cells:[0,7,4,7]},c,'base',()=>{calls++;return .1;}));assert.equal(calls,0);
 const skeleton={cells:[1,1,4,1,7,1]};for(const n of [0,.3,.99]){let calls=0;const full=board.fillDragonSkeleton(skeleton,c,'base',()=>{calls++;return n;});assert.equal(calls,6);assert.equal(board.evaluateDragon(c,full).rawPayout,2);}
});
test('free multipliers add, including duplicate faces; normalized totals follow Lua actual sums',()=>{
 const f=files(),d=f.config.dragon,dist=math.dragonFreeMultiplierDistribution(d);near(dist.reduce((s,r)=>s+r[1],0),1);const singleMean=(2*4000+5*5000+10*1500)/10500;near(dist.reduce((s,[m,w])=>s+m*w,0),singleMean*2.12);assert.ok(dist.some(([m])=>m===30));assert.ok(dist.some(([m])=>m===4));
});
test('capped eight-spin convolution matches direct enumeration and exact truncation',()=>{
 const a=math.cappedDragonMoments([.5,.5],8,3);let mean=0,second=0,hit=0;for(let mask=0;mask<256;mask++){const n=mask.toString(2).replaceAll('0','').length,pay=Math.min(n,3);mean+=pay/256;second+=pay*pay/256;if(n>=3)hit+=1/256;}near(a.mean,mean);near(a.second,second);near(a.capProbability,hit);
 const b=math.cappedDragonMoments([1],8,3);near(b.mean,0);near(b.capProbability,0);
 const f=files();f.base=[[500,1]];f.free=[[500,1]];f.config.dragon.boost.base=[[500,1]];f.config.dragon.boost.free=[[500,1]];f.config.parameters.baseSpinWinProbability=1;f.config.parameters.freeSpinWinProbability=1;f.config.parameters.freeSpinTriggerProbability=1;f.config.dragon.freeMultiplierCounts=[[3,1]];f.config.dragon.freeMultipliers=[[10,1]];
 const normal=math.calculateDragonModel(f,'normal'),boost=math.calculateDragonModel(f,'boost');near(normal.totalRtp,2500,1e-6);near(boost.totalRtp,2500,1e-6);near(normal.capProbability,1);near(boost.capProbability,1);
 const n=new DragonSimulator(f,'normal',1).round(),bRound=new DragonSimulator(f,'boost',1).round();assert.equal(n.boards,1);assert.equal(bRound.boards,5);assert.equal(n.paid,2500);assert.equal(bRound.paid,2500);
});
test('all eight losses remain free; seeded simulations match each capped model',()=>{
 const f=files();f.config.parameters.freeSpinTriggerProbability=1;f.config.parameters.freeSpinWinProbability=0;const r=new DragonSimulator(f,'normal',42).round();assert.deepEqual(r,{special:true,paid:0,boards:8,capped:false});
 for(const mode of ['normal','boost']){const f=files(),a=new DragonSimulator(f,mode,1048),b=new DragonSimulator(f,mode,1048),theory=math.calculateDragonModel(f,mode);for(let i=0;i<250000;i++){a.step();b.step();}const stats=a.result();assert.deepEqual(stats,b.result());assert.ok(Math.abs(stats.totalRtp-theory.totalRtp)<6*stats.standardError);near(stats.hitProbability,theory.hitProbability,.004);}
});
test('generated candidate coverage and all retained skeletons replay without extra wins',()=>{
 const c=read('paylines'),root=new URL('../../game_libraries/AG8/',import.meta.url);
 for(const mode of ['base','free']){const modeRoot=new URL(mode+'/',root),runs=fs.readdirSync(modeRoot).filter(n=>!n.startsWith('.')).sort(),dir=new URL(runs[0]+'/',modeRoot),buckets=JSON.parse(fs.readFileSync(new URL('library.json',dir)));assert.equal(Object.hasOwn(buckets,'0'),false);assert.deepEqual(board.dragonCoverage({buckets},math.dragonTargets(files(),mode).map(m=>[m,1])).missing,[]);
  for(const [key,list] of Object.entries(buckets))for(const s of list)for(const seed of [0,42,1048]){let calls=0;const random=seededRandom(seed),before=board.inspectDragonSkeleton(s,c,mode),full=board.fillDragonSkeleton(s,c,mode,()=>{calls++;return random();}),after=board.evaluateDragon(c,full,mode);assert.equal(calls,9-s.cells.length/2);assert.equal(after.rawPayout,Number(key));assert.deepEqual(after.wins,before.wins);}
 }
});
test('generator determinism, explicit missing targets and capacity changes do not alter numerical model',()=>{
 const c=read('paylines'),run=()=>{const g=new board.DragonSkeletonGenerator(c,{mode:'base',count:1000,seed:3,perMultiplier:2,maxRetained:100},[2,500]);while(!g.done)g.step();return g.result();};assert.deepEqual(run(),run());assert.deepEqual(board.dragonCoverage({buckets:{}},[[2,1],[500,0]]).missing,['2']);assert.throws(()=>new board.DragonSkeletonGenerator(c,{mode:'base',count:0,seed:3,perMultiplier:2,maxRetained:100},[2]));
});
