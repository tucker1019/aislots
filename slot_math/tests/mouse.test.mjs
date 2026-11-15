import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function load(url){if(cache.has(url.href))return cache.get(url.href);const m={exports:{}};cache.set(url.href,m.exports);const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(p=>load(new URL(p+'.ts',url)),m.exports,m);return m.exports;}
const mouse=load(new URL('../src/domain/fortuneMouse.ts',import.meta.url)),math=load(new URL('../src/domain/mouseMath.ts',import.meta.url)),model=load(new URL('../src/domain/model.ts',import.meta.url)),{MouseSimulator,mouseLossCount}=load(new URL('../src/domain/mouseSimulation.ts',import.meta.url)),{seededRandom}=load(new URL('../src/domain/simulation.ts',import.meta.url)),settings=load(new URL('../src/domain/settings.ts',import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(new URL('../../game_configs/AG6/'+name+'.json',import.meta.url)));
const fixture=()=>read('paylines'),table=rows=>model.parseWeightTable(JSON.stringify(rows)),parameters=(p={})=>({...read('config').parameters,...p});
const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('1019 runtime provenance, positive raw units, explicit zero-weight jackpot and settings roundtrip',()=>{
 const source=read('lua-1019-source'),base=source.sourceNormal.filter(r=>r[0]>0),free=source.sourceSpecial.filter(r=>r[0]>0),hit=source.normalPositiveWeight/source.normalTotalWeight;
 assert.equal(source.sha256,'d5b4f88b0b462854160c07b5c80c3f8083854c7f230b9bdd31e38cbed7cb1b1c');assert.equal(base.length,312);assert.equal(free.length,267);near(hit,.28,1e-12);
 assert.deepEqual(read('base'),[...base,[5000,0]]);assert.deepEqual(read('free'),[...free,[5000,0]]);assert.ok(base.some(([m])=>m===1000));
 const files={base:read('base'),free:read('free'),config:read('config')};settings.validateGameFiles(files);assert.deepEqual(settings.filesFromSettings(settings.settingsFromFiles(files),settings.simulationOptionsFromFiles(files)),files);
 const r=math.calculateMouseModel(table(base),table(free),parameters({baseSpinWinProbability:hit,freeSpinTriggerProbability:.014}));near(r.totalRtp,.9702532390813169);near(r.hitProbability,.29008);
 for(const p of [{lineCount:10},{freeSpinWinProbability:.5},{featureSpins:8},{freeSpinAwardWeights:[[8,1]]},{freeSpinTriggerProbability:1.1}])assert.throws(()=>settings.validateGameFiles({...files,config:{...files.config,parameters:{...files.config.parameters,...p}}}));
 for(const rows of [[[0,1]],[[1.2,1]],[[3,1],[3,1]],[[6000,1]]])assert.throws(()=>math.calculateMouseModel(table(rows),table(free),parameters()));
});
test('five lines highest Wild substitution; orange bet example; jackpot replaces all lines',()=>{
 const c=fixture(),board=[2,0,0,7,0,0,2,0,0];let r=mouse.evaluateMouse(c,board);assert.equal(r.rawPayout,5);assert.equal(r.totalBetMultiplier*10,10);assert.equal(r.wins.length,1);
 r=mouse.evaluateMouse(c,Array(9).fill(7));assert.equal(r.rawPayout,5000);assert.equal(r.totalBetMultiplier,1000);assert.deepEqual(r.wins,[]);
 const mixed=Array(9).fill(7);mixed[0]=5;r=mouse.evaluateMouse(c,mixed);assert.equal(r.rawPayout,1000);assert.equal(r.totalBetMultiplier,200);assert.equal(r.jackpot,false);
 assert.throws(()=>mouse.evaluateMouse(c,Array(9).fill(1),'free'));const bad=structuredClone(c);bad.lines[0]=[1,2,3];assert.throws(()=>mouse.validateMouseConfig(bad));
});
test('normal and special are alternatives; feature pays once and has no added normal award',()=>{
 const b=table([[5,1]]),f=table([[50,1]]);
 for(const [trigger,expected] of [[0,1],[1,10]]){const p=parameters({baseSpinWinProbability:1,freeSpinTriggerProbability:trigger}),sim=new MouseSimulator(b,f,p,1019);for(let i=0;i<100;i++){const r=sim.round();assert.equal(r.paid,expected);if(trigger)assert.ok(r.lossBoards>=2&&r.lossBoards<=5);}}
 const r=math.calculateMouseModel(b,f,parameters({baseSpinWinProbability:.5,freeSpinTriggerProbability:.1}));near(r.baseRtp,.45);near(r.freeRtp,1);near(r.totalRtp,1.45);near(r.hitProbability,.55);near(r.totalVariance,.45+10-1.45**2);
});
test('Lua length boundaries and source integer intervals are retained',()=>{
 for(const [raw,extra] of [[3,1],[74,1],[75,2],[199,2],[200,3],[499,3],[500,4],[5000,4]]){assert.equal(math.mouseLossExtra(raw),extra);assert.equal(mouseLossCount(raw,()=>0),1+extra);assert.equal(mouseLossCount(raw,()=>.9999999),4+extra);}
 for(const [draw,base] of [[1,1],[149,1],[150,2],[749,2],[750,3],[1049,3],[1050,4],[1200,4]])assert.equal(mouseLossCount(3,()=>(draw-.5)/1200),base+1);
});
test('seeded numerical simulation agrees with the same mixture theory',()=>{
 const b=table([[5,1],[10,1]]),f=table([[25,1],[50,1]]),p=parameters({baseSpinWinProbability:.5,freeSpinTriggerProbability:.2}),theory=math.calculateMouseModel(b,f,p),a=new MouseSimulator(b,f,p,42),bSim=new MouseSimulator(b,f,p,42);
 for(let i=0;i<200000;i++){a.step();bSim.step();}assert.deepEqual(a.result(),bSim.result());near(a.result().totalRtp,theory.totalRtp,.025);near(a.result().hitProbability,theory.hitProbability,.004);assert.ok(a.result().averageFeatureBoards>=3&&a.result().averageFeatureBoards<=6);
});
test('losses and skeleton holes fill in a single pass with one draw per hole',()=>{
 const c=fixture();for(const mode of ['base','free'])for(const value of [0,.3,.9,.999999]){let calls=0;const b=mouse.generateMouseLoss(c,mode,()=>{calls++;return value;});assert.equal(calls,mode==='base'?9:6);assert.equal(mouse.evaluateMouse(c,b,mode).rawPayout,0);assert.ok(b.every(id=>id>0));}
 const board=[1,2,3,7,7,7,1,4,5],s=mouse.mouseSkeleton(c,board,'free'),before=mouse.inspectMouseSkeleton(s,c,'free');
 for(let seed=0;seed<100;seed++){let calls=0;const random=seededRandom(seed),filled=mouse.fillMouseSkeleton(s,c,'free',()=>{calls++;return random();});assert.equal(calls,9-s.cells.length/2);const after=mouse.evaluateMouse(c,filled,'free');assert.deepEqual(after.wins,before.wins);assert.equal(after.rawPayout,before.rawPayout);for(let j=0;j<s.cells.length;j+=2)assert.equal(filled[s.cells[j]],s.cells[j+1]);}
 let calls=0;assert.throws(()=>mouse.fillMouseSkeleton({cells:[0,7,3,7]},c,'base',()=>{calls++;return .5;}));assert.equal(calls,0);
 assert.throws(()=>mouse.inspectMouseSkeleton({cells:[0,1,0,1]},c,'base'));assert.throws(()=>mouse.inspectMouseSkeleton({...s,bet:10},c,'free'));
});
test('all positive runtime rows get exact, replayable, single-pass-fillable skeletons',()=>{
 const c=fixture();
 for(const mode of ['free','base']){
  const rows=read(mode),targets=rows.map(r=>r[0]),g=new mouse.MouseSkeletonGenerator(c,{mode,count:41000000,seed:1019,perMultiplier:2,maxRetained:15000},targets);
  while(!g.done)g.step();const result=g.result();console.log(`AG6 ${mode}: ${result.stats.generated} enumerated, ${result.stats.retained} retained`);
  assert.deepEqual(mouse.mouseCoverage(result,rows).missing,[]);assert.ok(result.buckets['5000']?.length);assert.equal(Object.hasOwn(result.buckets,'0'),false);mouse.validateMouseLibrary(result,c);
  for(const [key,list] of Object.entries(result.buckets))for(const s of list){for(const value of [0,.9999999]){const filled=mouse.fillMouseSkeleton(s,c,mode,()=>value),r=mouse.evaluateMouse(c,filled,mode);assert.equal(r.rawPayout,Number(key));}}
  const corrupt=structuredClone(result);corrupt.buckets['4']=corrupt.buckets['3'];delete corrupt.buckets['3'];assert.throws(()=>mouse.validateMouseLibrary(corrupt,c));
 }
});
test('fixed seed reproducibility, stop keeps completed skeletons, coverage and capacities do not alter weights',()=>{
 const c=fixture(),rows=read('free'),run=(per=1)=>{const g=new mouse.MouseSkeletonGenerator(c,{mode:'free',count:2000,seed:3,perMultiplier:per,maxRetained:15000},[3,5,5000]);for(let i=0;i<1000&&!g.done;i++)g.step();return g.result(true);},a=run();assert.deepEqual(a,run());assert.equal(a.partial,true);mouse.validateMouseLibrary(a,c);
 const b=run(3);assert.ok(b.stats.retained>a.stats.retained);assert.deepEqual(read('free'),rows);const theory=math.calculateMouseModel(table(read('base')),table(rows),parameters());assert.equal(theory.totalRtp,math.calculateMouseModel(table(read('base')),table(rows),parameters()).totalRtp);
 assert.deepEqual(mouse.mouseCoverage(a,[[4,1],[5000,0]]).missing,['4']);
});
