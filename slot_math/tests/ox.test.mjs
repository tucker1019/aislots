import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function load(url){if(cache.has(url.href))return cache.get(url.href);const m={exports:{}};cache.set(url.href,m.exports);new Function('require','exports','module',ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(p=>load(new URL(p+'.ts',url)),m.exports,m);return m.exports;}
const ox=load(new URL('../src/domain/fortuneOx.ts',import.meta.url)),math=load(new URL('../src/domain/oxMath.ts',import.meta.url)),model=load(new URL('../src/domain/model.ts',import.meta.url)),{OxSimulator,oxLossCount}=load(new URL('../src/domain/oxSimulation.ts',import.meta.url)),{seededRandom}=load(new URL('../src/domain/simulation.ts',import.meta.url)),settings=load(new URL('../src/domain/settings.ts',import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(new URL('../../game_configs/AG7/'+name+'.json',import.meta.url))),table=rows=>model.parseWeightTable(JSON.stringify(rows)),parameters=(p={})=>({...read('config').parameters,...p}),near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('1023 runtime tables and effective probabilities roundtrip without importing results',()=>{
 const source=read('lua-1023-source'),files={base:read('base'),free:read('free'),config:read('config')};
 assert.equal(source.sha256,'2d6f9cfa27bbba982da4d39b10c9e6f043b97d24428bc42a71904a7140433bdb');
 assert.deepEqual(files.base,[...source.sourceNormal.filter(r=>r[0]>0),[20000,0]]);assert.deepEqual(files.free,source.sourceSpecial);
 assert.equal(files.base.length,78);assert.equal(files.free.length,26);assert.equal(files.config.parameters.baseSpinWinProbability,.29);assert.equal(files.config.parameters.freeSpinTriggerProbability,.007);
 settings.validateGameFiles(files);assert.deepEqual(settings.filesFromSettings(settings.settingsFromFiles(files),settings.simulationOptionsFromFiles(files)),files);
 const r=math.calculateOxModel(table(files.base),table(files.free),parameters());near(r.hitProbability,.29497);near(r.totalRtp,(1-.007)*.29*table(files.base).mean/10+.007*table(files.free).mean/10);
 for(const p of [{lineCount:5},{freeSpinWinProbability:.5},{featureSpins:8},{freeSpinAwardWeights:[[8,1]]},{freeSpinTriggerProbability:1.1}])assert.throws(()=>settings.validateGameFiles({...files,config:{...files.config,parameters:{...files.config.parameters,...p}}}));
 for(const rows of [[[0,1]],[[1.2,1]],[[3,1],[3,1]],[[20001,1]]])assert.throws(()=>math.calculateOxModel(table(rows),table(files.free),parameters()));
 assert.throws(()=>math.calculateOxModel(table(files.base),table([[20000,1]]),parameters()));
});
test('ten screenshot lines and both confirmed full-board replacement rules',()=>{
 const c=read('paylines');assert.deepEqual(c.columnHeights,[3,4,3]);
 for(let i=0;i<10;i++){const b=Array(10).fill(0);c.lines[i].forEach(p=>b[p-1]=2);const r=ox.evaluateOx(c,b);assert.equal(r.rawPayout,5);assert.equal(r.wins.length,1);assert.equal(r.wins[0].line,i+1);}
 const mixed=Array(10).fill(7);mixed[3]=2;let r=ox.evaluateOx(c,mixed);assert.equal(r.fullSymbolId,2);assert.equal(r.rawPayout,500);assert.equal(r.totalBetMultiplier*10,500);assert.ok(r.wins.every(w=>w.payout===50&&w.symbolId===2));
 r=ox.evaluateOx(c,Array(10).fill(7));assert.equal(r.rawPayout,20000);assert.equal(r.totalBetMultiplier*10,20000);assert.equal(r.jackpot,true);assert.deepEqual(r.wins,[]);
 for(let id=1;id<=6;id++){r=ox.evaluateOx(c,Array(10).fill(id));assert.equal(r.rawPayout,c.symbols[id-1].payout*100);}
 const wildLine=Array(10).fill(0);c.lines[0].forEach(p=>wildLine[p-1]=7);assert.equal(ox.evaluateOx(c,wildLine).rawPayout,200);
 const invalid=[2,3,4,1,1,1,1,2,3,4];assert.throws(()=>ox.evaluateOx(c,invalid,'free'));assert.throws(()=>ox.evaluateOx(c,Array(10).fill(7),'free'));
});
test('single-pass losses draw once per hole and all special sides share one ordinary symbol',()=>{
 const c=read('paylines'),sides=[0,1,2,7,8,9];
 for(const mode of ['base','free'])for(const value of [0,.3,.9,.999999]){let calls=0;const b=ox.generateOxLoss(c,mode,()=>{calls++;return value;});assert.equal(calls,mode==='base'?10:5);assert.equal(ox.evaluateOx(c,b,mode).rawPayout,0);assert.ok(b.every(id=>id>=1&&id<=6));if(mode==='free')assert.ok(sides.every(p=>b[p]===b[0]));}
 let calls=0;assert.throws(()=>ox.fillOxSkeleton({cells:[0,7,3,7]},c,'base',()=>{calls++;return .5;}));assert.equal(calls,0);
});
test('all 77 ordinary and 26 special positive buckets replay exactly with one-pass completion',()=>{
 const c=read('paylines');
 for(const mode of ['free','base']){const rows=read(mode),g=new ox.OxSkeletonGenerator(c,{mode,count:1000000,seed:1023,perMultiplier:3,maxRetained:15000},rows.map(r=>r[0]));while(!g.done)g.step();const result=g.result();ox.validateOxLibrary(result,c);assert.deepEqual(ox.oxCoverage(result,rows).missing,[]);assert.equal(Object.hasOwn(result.buckets,'0'),false);
  for(const [key,list] of Object.entries(result.buckets))for(const s of list)for(const seed of [0,42,1000]){let calls=0;const random=seededRandom(seed),before=ox.inspectOxSkeleton(s,c,mode),b=ox.fillOxSkeleton(s,c,mode,()=>{calls++;return random();}),after=ox.evaluateOx(c,b,mode);assert.equal(calls,10-s.cells.length/2);assert.equal(after.rawPayout,Number(key));assert.deepEqual(after.wins,before.wins);}
  assert.equal(!!result.buckets['20000'],mode==='base');const corrupt=structuredClone(result);corrupt.stats.bytes++;assert.throws(()=>ox.validateOxLibrary(corrupt,c));
 }
});
test('actual 10000-range Lua length intervals are retained, including truncated seventh interval',()=>{
 assert.deepEqual(math.OX_LENGTH_WEIGHTS,read('lua-1023-source').featureLength.effectiveLossWeights);
 for(const [draw,n] of [[1,2],[100,2],[101,3],[600,3],[601,4],[1600,4],[1601,5],[4100,5],[4101,6],[7300,6],[7301,7],[9600,7],[9601,8],[10000,8]])assert.equal(oxLossCount(()=>(draw-.5)/10000),n);
});
test('seeded simulation follows the exclusive mixture and is independent of board counts',()=>{
 const b=table([[5,1],[10,1]]),f=table([[50,1],[100,1]]),p=parameters({baseSpinWinProbability:.5,freeSpinTriggerProbability:.2}),theory=math.calculateOxModel(b,f,p),a=new OxSimulator(b,f,p,42),bSim=new OxSimulator(b,f,p,42);
 for(let i=0;i<200000;i++){a.step();bSim.step();}assert.deepEqual(a.result(),bSim.result());near(a.result().totalRtp,theory.totalRtp,.025);near(a.result().hitProbability,theory.hitProbability,.004);near(a.result().averageFeatureBoards,6.67,.04);
 const r=new OxSimulator(table([[5,1]]),table([[50,1]]),parameters({baseSpinWinProbability:1,freeSpinTriggerProbability:1}),1023);for(let i=0;i<20;i++){const x=r.round();assert.equal(x.paid,5);assert.ok(x.lossBoards>=2&&x.lossBoards<=8);}
});
test('fixed seed, partial results, retention limits and explicit missing coverage',()=>{
 const c=read('paylines'),run=()=>{const g=new ox.OxSkeletonGenerator(c,{mode:'free',count:1000000,seed:3,perMultiplier:2,maxRetained:15000},read('free').map(r=>r[0]));for(let i=0;i<1000&&!g.done;i++)g.step();return g.result(true);},r=run();assert.deepEqual(r,run());assert.equal(r.partial,true);ox.validateOxLibrary(r,c);assert.deepEqual(ox.oxCoverage(r,[[4,1],[20000,0]]).missing,['4']);
});
