import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function load(url){if(cache.has(url.href))return cache.get(url.href);const m={exports:{}};cache.set(url.href,m.exports);const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(p=>load(new URL(p+'.ts',url)),m.exports,m);return m.exports;}
const rabbit=load(new URL('../src/domain/fortuneRabbit.ts',import.meta.url)),model=load(new URL('../src/domain/model.ts',import.meta.url)),{RabbitSimulator}=load(new URL('../src/domain/rabbitSimulation.ts',import.meta.url)),{seededRandom}=load(new URL('../src/domain/simulation.ts',import.meta.url)),settings=load(new URL('../src/domain/settings.ts',import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(new URL('../../game_configs/AG5/'+name+'.json',import.meta.url)));
const fixture=()=>read('paylines'),table=rows=>model.parseWeightTable(JSON.stringify(rows)),parameters=(p={})=>({...read('config').parameters,...p});
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('AG5 Lua import preserves positive normal rows; special table is a sum distribution',()=>{
 const source=read('lua-1018-source'),config=read('config'),base=read('base');
 // Business probabilities may be tuned after importing; verify Lua against its provenance.
 config.parameters={...config.parameters,baseSpinWinProbability:base.reduce((s,r)=>s+r[1],0)/source.sourceTotalWeight,freeSpinWinProbability:source.specialHitProbability};
 const files={base,free:read('free'),config};settings.validateGameFiles(files);settings.validateGameFiles({base,free:read('free'),config:read('config')});
 assert.equal(files.base.length,1440);assert.equal(files.free.length,2635);assert.equal(files.free[0][0],25);assert.equal(files.free.at(-1)[0],20000);
 const b=table(files.base),f=table(files.free);near(f.totalWeight,1);near(files.config.parameters.freeSpinWinProbability,.3668967424);near(b.mean*files.config.parameters.baseSpinWinProbability/10,.8754828064686292);
 const restored=settings.settingsFromFiles(files),roundtrip=settings.filesFromSettings(restored,settings.simulationOptionsFromFiles(files));assert.deepEqual(roundtrip,files);
 assert.equal('freeSpinAwardWeights' in roundtrip.config.parameters,false);
 const c=fixture(),rMean=c.rewards.reduce((s,r)=>s+r.payout*r.weight,0)/c.rewards.reduce((s,r)=>s+r.weight,0);
 // E[N 1(N>=5)] = 10 p P(Binomial(9,p)>=4).
 let probability=0;for(let k=4;k<=9;k++){let choose=1;for(let j=1;j<=k;j++)choose=choose*(10-j)/j;probability+=choose*.4**k*.6**(9-k);}
 near(f.mean*files.config.parameters.freeSpinWinProbability,4*probability*rMean);
});
test('ten Lua lines and highest award per line; rewards never Wild substitute',()=>{
 const c=fixture();rabbit.validateRabbitConfig(c);
 const board=Array(10).fill(0);[1,4,8].forEach(p=>board[p-1]=6);let r=rabbit.evaluateRabbit(c,board);assert.equal(r.rawPayout,100);assert.equal(r.totalBetMultiplier,10);
 board[0]=7;r=rabbit.evaluateRabbit(c,board);assert.equal(r.rawPayout,100);board[3]=7;board[7]=7;assert.equal(rabbit.evaluateRabbit(c,board).rawPayout,200);
 board[3]=11;assert.equal(rabbit.evaluateRabbit(c,board).rawPayout,0);
 assert.equal(rabbit.evaluateRabbit(c,Array(10).fill(7)).rawPayout,2000);
 assert.throws(()=>rabbit.evaluateRabbit(c,Array(10).fill(1),'free'));
});
test('five rewards pay all values in this spin; normal lines stack; no retained symbols',()=>{
 const c=fixture(),board=[6,11,12,6,13,14,15,6,0,0];let r=rabbit.evaluateRabbit(c,board);assert.equal(r.linePayout,100);assert.equal(r.rewardPayout,185);assert.equal(r.rawPayout,285);
 assert.equal(rabbit.evaluateRabbit(c,[11,12,13,0,0,0,0,0,0,0],'free').rawPayout,0);
 assert.equal(rabbit.evaluateRabbit(c,[14,15,0,0,0,0,0,0,0,0],'free').rawPayout,0);
 const six=[11,12,13,14,15,16,0,0,0,0];assert.equal(rabbit.evaluateRabbit(c,six,'free').rawPayout,385);
});
test('skeleton replay and live fills keep awards and all necessary cells',()=>{
 const c=fixture(),b=[6,11,12,6,13,14,15,6,2,3],s=rabbit.rabbitSkeleton(c,b,'base');assert.equal(s.cells.length,16);
 for(let i=0;i<20;i++){const filled=rabbit.fillRabbitSkeleton(s,c,'base',seededRandom(i));assert.equal(rabbit.evaluateRabbit(c,filled).rawPayout,285);assert.equal(filled.length,10);assert.ok(filled.every(id=>id>0));}
 for(const mode of ['base','free'])for(let i=0;i<20;i++)assert.equal(rabbit.evaluateRabbit(c,rabbit.generateRabbitLoss(c,mode,seededRandom(i)),mode).rawPayout,0);
 const special=rabbit.rabbitSkeleton(c,[11,12,13,14,15,0,0,0,0,0],'free');assert.deepEqual(rabbit.fillRabbitSkeleton(special,c,'free'),[11,12,13,14,15,0,0,0,0,0]);
 assert.throws(()=>rabbit.inspectRabbitSkeleton({cells:[0,1,0,1]},c,'base'));
 assert.throws(()=>rabbit.inspectRabbitSkeleton({...s,winMinor:1},c,'base'));
 assert.throws(()=>rabbit.inspectRabbitSkeleton({cells:[0,6,3,6,7,6,9,2]},c,'base'));
});
test('single-pass fill draws exactly once per hole and never changes fixed wins',()=>{
 const c=fixture(),board=[6,11,12,6,13,14,15,6,0,0],s=rabbit.rabbitSkeleton(c,board,'base');
 for(const value of [0,.5,.999999]){let calls=0;const filled=rabbit.fillRabbitSkeleton(s,c,'base',()=>{calls++;return value;});assert.equal(calls,2);assert.equal(rabbit.evaluateRabbit(c,filled).rawPayout,285);for(let i=0;i<s.cells.length;i+=2)assert.equal(filled[s.cells[i]],s.cells[i+1]);}
 const invalid={cells:[1,7,4,7,0,6,7,6,5,6,9,6]};let calls=0;
 assert.throws(()=>rabbit.fillRabbitSkeleton(invalid,c,'base',()=>{calls++;return .5;}));assert.equal(calls,0);
 const disabled=structuredClone(c);disabled.symbols[0].weight=0;disabled.symbols[1].weight=0;assert.throws(()=>rabbit.validateRabbitConfig(disabled));
 const sparse=structuredClone(c);sparse.symbols[0].weight=0;rabbit.validateRabbitConfig(sparse);
 for(let i=0;i<100;i++)assert.ok(!rabbit.generateRabbitLoss(sparse,'base',seededRandom(i)).includes(1));
});
test('loss decoration draws a bounded count, distinct positions and then fills once',()=>{
 for(const probability of [0,.4,1])for(const mode of ['base','free']){
  const c=fixture();c.generation.rewardProbability=probability;let calls=0;
  const board=rabbit.generateRabbitLoss(c,mode,()=>{calls++;return .5;}),e=rabbit.evaluateRabbit(c,board,mode);
  assert.equal(e.rawPayout,0);assert.ok(e.rewardCount<=4);assert.equal(calls,1+e.rewardCount*2+(mode==='base'?10-e.rewardCount:0));
  if(probability===1)assert.equal(e.rewardCount,4);if(probability===0)assert.equal(e.rewardCount,0);
 }
});
test('ordinary pays first, feature keeps all eight winning spins, cap pays only headroom',()=>{
 let p=parameters({baseSpinWinProbability:1,freeSpinWinProbability:1,freeSpinTriggerProbability:1});
 let sim=new RabbitSimulator(table([[1000,1]]),table([[100,1]]),p,2),r=sim.round();assert.equal(r.basePaid,100);assert.equal(r.specialPaid.length,8);assert.deepEqual(r.specialPaid,Array(8).fill(10));assert.equal(r.totalPaid,180);
 sim=new RabbitSimulator(table([[47000,1]]),table([[10000,1]]),p,2);r=sim.round();assert.equal(r.totalPaid,5000);assert.deepEqual(r.specialDue,[1000]);assert.deepEqual(r.specialPaid,[300]);assert.equal(r.capped,true);
 sim=new RabbitSimulator(table([[60000,1]]),table([[100,1]]),p,2);r=sim.round();assert.equal(r.basePaid,5000);assert.equal(r.specialPaid.length,0);
});
test('theory convolves the full capped flow and separates actual contributions',()=>{
 const b=table([[47000,1]]),f=table([[10000,1]]),p=parameters({baseSpinWinProbability:1,freeSpinWinProbability:1,freeSpinTriggerProbability:.25}),r=model.calculateRabbitModel(b,f,p);
 near(r.baseRtp,4700);near(r.freeRtp,75);near(r.totalRtp,4775);near(r.uncappedRtp,6700);near(r.capLoss,1925);near(r.capProbability,.25);near(r.totalVariance,.25*.75*300**2);
 const zero=model.calculateRabbitModel(b,f,parameters({baseSpinWinProbability:0,freeSpinWinProbability:0,freeSpinTriggerProbability:1}));assert.equal(zero.totalRtp,0);
 const regular=model.calculateRabbitModel(table([[10,1],[20,1]]),table([[30,1]]),parameters({baseSpinWinProbability:.5,freeSpinWinProbability:.25,freeSpinTriggerProbability:.1}));near(regular.totalRtp,.75+.1*8*.25*3);
 assert.throws(()=>model.calculateRabbitModel(table([[0,1]]),f,p));assert.throws(()=>model.calculateRabbitModel(b,f,{...p,freeSpinAwardWeights:[[8,1]]}));
});
test('seeded simulation matches exact capped binomial outcomes',()=>{
 const b=table([[47000,1]]),f=table([[10000,1]]),p=parameters({baseSpinWinProbability:1,freeSpinWinProbability:1,freeSpinTriggerProbability:.25});
 const a=new RabbitSimulator(b,f,p,42),bSim=new RabbitSimulator(b,f,p,42);for(let i=0;i<10000;i++){a.step();bSim.step();}assert.deepEqual(a.result(),bSim.result());near(a.result().totalRtp,4775,4);assert.ok(a.result().specialSpins===a.result().triggers);
});
test('dense FFT cap calculation agrees with an independent integer-grid reference',()=>{
 const p=parameters({baseSpinWinProbability:.8,freeSpinWinProbability:.4,freeSpinTriggerProbability:.6}),b=table([[35000,1]]),f=table(Array.from({length:400},(_,i)=>[(i+1)*100,1]));
 const r=model.calculateRabbitModel(b,f,p);let distribution=new Float64Array(501);distribution[0]=1;
 // Independent direct convolution on the exact common 100-raw-unit grid.
 for(let spin=0;spin<8;spin++){const next=new Float64Array(501);for(let i=0;i<=500;i++){next[i]+=distribution[i]*.6;for(let j=1;j<=400;j++)next[Math.min(500,i+j)]+=distribution[i]*.4/400;}distribution=next;}
 let mean=.4*.8*3500,second=.4*.8*3500**2,cap=0;
 for(let i=0;i<=500;i++)for(const [ordinary,probability] of [[0,.2],[350,.8]]){const paid=Math.min(500,i+ordinary)*10,weight=.6*distribution[i]*probability;mean+=weight*paid;second+=weight*paid**2;if(paid===5000)cap+=weight;}
 near(r.totalRtp,mean,1e-6);near(r.baseRtp,2800);near(r.freeRtp,mean-2800,1e-6);near(r.capProbability,cap,1e-9);near(r.totalVariance,second-mean**2,1e-3);
});
test('targeted generation covers special sums; missing table values stay explicit',()=>{
 const c=fixture(),options={mode:'free',count:200,seed:18,perMultiplier:2,maxRetained:100},targets=[25,30,185,20000];
 const run=()=>{const g=new rabbit.RabbitSkeletonGenerator(c,options,targets,seededRandom(options.seed));while(!g.done)g.step();return g.result();},r=run();assert.deepEqual(r,run());rabbit.validateRabbitLibrary(r,c);
 assert.deepEqual(rabbit.rabbitCoverage(r,targets.map(m=>[m,1])).missing,[]);assert.equal(Object.hasOwn(r.buckets,'0'),false);
 assert.deepEqual(rabbit.rabbitCoverage(r,[[25,1],[26,1],[1,0]]).missing,['26']);
 const changed=structuredClone(r);changed.buckets['24']=changed.buckets['25'];delete changed.buckets['25'];assert.throws(()=>rabbit.validateRabbitLibrary(changed,c));
 const extra=structuredClone(r);extra.options.betMinor=1;assert.throws(()=>rabbit.validateRabbitLibrary(extra,c));
 const more=new rabbit.RabbitSkeletonGenerator(c,{...options,perMultiplier:5},targets,seededRandom(18));while(!more.done)more.step();assert.ok(more.result().stats.retained>r.stats.retained);
 // Geometry capacity does not mutate either numerical input table.
 assert.deepEqual(read('config').parameters,parameters());
});
test('all positive Lua multiplier rows have independently replayable winning skeletons',()=>{
 const c=fixture();
 for(const mode of ['base','free']){
  const rows=read(mode),g=new rabbit.RabbitSkeletonGenerator(c,{mode,count:6000,seed:1018,perMultiplier:1,maxRetained:15000},rows.map(r=>r[0]),seededRandom(1018));while(!g.done)g.step();const result=g.result();assert.deepEqual(rabbit.rabbitCoverage(result,rows).missing,[]);rabbit.validateRabbitLibrary(result,c);
 }
});
