import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { cascade, library, symbol, setup } from './helpers/board.mjs';
import { createLibraryStore } from '../server/board-library.mjs';
import { createGameMiddleware } from '../server/game-files.mjs';
const {createCascadeRound,advanceCascadeRound}=cascade;
const {encodeSkeleton,inspectSkeleton,rawMultiplierKey,LibraryGenerator,validateLibrary}=library;
function config(heights=[2,2,2,2,2]) {
  return {...setup(heights),gold:{columns:[2,3,4],baseProbability:0,freeProbability:0,wildSymbolId:'10'},symbols:[{...symbol('1'),payouts:{3:2}},{...symbol('3'),payouts:{3:1}},{...symbol('2'),payouts:{}},symbol('10','wild',0)]};
}
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function finished(c,preset,draws) {
  let index=0,round=createCascadeRound(c,()=>0,preset);
  const random=()=>{assert.ok(index<draws.length);return draws[index++];};
  while(!round.finished&&!round.limited)round=advanceCascadeRound(round,c,random);
  return round;
}
test('compact skeleton captures gold birth, future refills and raw multiplier without line normalization',()=>{
  const c=config(),r=finished(c,[['1','2'],['1001','2'],['1','2'],['2','2'],['2','2']],[.5,.5,.99,.99,.99]);
  assert.equal(r.steps.length,2);
  const data=encodeSkeleton(r);
  assert.deepEqual(data,[3,0,1,2,1001,4,1,2,0,3,4,3,0]);
  assert.equal(data.includes(10),false);
  assert.equal(rawMultiplierKey(r,c),'4');
  assert.deepEqual(inspectSkeleton(data,c,'base'),{key:'4',cascades:2});
  assert.equal(inspectSkeleton(data,{...c,lineCount:999},'base').key,'4');
  assert.equal(inspectSkeleton(data,c,'free').key,'8');
});
test('initial icons that win after falling remain fixed; an empty intermediate refill does not truncate the chain',()=>{
  const c=config(),r=finished(c,[['1','3'],['1001','2'],['1','3'],['2','2'],['2','2']],[.99,.99,.99,.99,.99,.99]);
  const data=encodeSkeleton(r);
  assert.equal(data[0],5);assert.deepEqual(data.slice(-2),[0,0]);
  assert.deepEqual(inspectSkeleton(data,c,'base'),{key:'4',cascades:2});
});
test('raw multiplier keys preserve configured decimal payouts and factors exactly',()=>{
  const c=config([1,1,1]);c.symbols[0].payouts[3]=.1;c.cascadeFactors=[.2];
  const r=finished(c,[['1'],['1'],['1']],[.99,.99,.99]);
  assert.equal(rawMultiplierKey(r,c),'0.02');assert.equal(inspectSkeleton(encodeSkeleton(r),c,'base').key,'0.02');
});
test('malformed, duplicate, nonwinning, incomplete and direct-wild skeletons are rejected',()=>{
  const c=config();
  for(const row of [[0],[1,0],[1,-1,1,0],[2,0,1,0,1,0],[1,0,10,0],[1,0,2,0],[3,0,1,2,1001,4,1],[3,0,1,2,1001,4,1,1,2,3]])assert.throws(()=>inspectSkeleton(row,c,'base'));
  const empty=createCascadeRound(c,()=>.99);assert.throws(()=>encodeSkeleton(empty));
});
test('generation is deterministic, deduplicated, bounded per bucket, mode-specific and replayable',()=>{
  const c=config(),options={mode:'base',count:300,seed:42,perMultiplier:2};
  const a=new LibraryGenerator(c,options,rng(42)),b=new LibraryGenerator(c,options,rng(42));
  while(!a.done)a.step(19);while(!b.done)b.step(7);
  assert.deepEqual(a.result(),b.result());
  assert.equal(a.stats.completed,300);assert.equal(a.stats.completed,a.stats.wins+a.stats.losses+a.stats.limited);
  assert.ok(a.stats.retained>0);assert.ok(a.stats.wins>a.stats.retained);
  for(const [key,rows]of Object.entries(a.buckets)){assert.ok(rows.length<=2);assert.equal(new Set(rows.map(r=>JSON.stringify(r))).size,rows.length);for(const row of rows)assert.equal(inspectSkeleton(row,c,'base').key,key);}
  validateLibrary(a.result(),c);
  const bad=structuredClone(a.result());bad.stats.retained++;assert.throws(()=>validateLibrary(bad,c));
});
test('losses and cascade-limited rounds are excluded, and partial runs can be retained',()=>{
  const c=config([1,1,1]),options={mode:'base',count:10,seed:1,perMultiplier:2};
  const loss=new LibraryGenerator(c,options,()=>.99);loss.step(3);assert.equal(loss.stats.losses,3);assert.equal(loss.done,false);assert.deepEqual(loss.result().buckets,{});validateLibrary(loss.result(),c);
  const limit=new LibraryGenerator(c,options,()=>0);limit.step();assert.equal(limit.stats.limited,1);assert.equal(limit.stats.retained,0);
  assert.throws(()=>new LibraryGenerator(c,{...options,count:100000001},()=>0));
});
async function serverFixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'slot-library-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const c=config(),{lineCount,...file}=c;file.version=1;file.seed=null;
  let revision='a'.repeat(64);
  const boardStore={read:async id=>{if(id!=='AG1')throw new Error('unexpected ID');return {revision,file,lineCount:20};}};
  const store=createLibraryStore(root,boardStore,validateLibrary);
  const gen=new LibraryGenerator(c,{mode:'base',count:20,seed:7,perMultiplier:2},rng(7));while(!gen.done)gen.step(10);
  return {root,store,boardStore,result:gen.result(),change:()=>{revision='b'.repeat(64);}};
}
test('saving writes only multiplier-to-array JSON plus versioned manifest into an immutable run directory',async t=>{
  const f=await serverFixture(t),saved=await f.store.save('AG1','a'.repeat(64),f.result,'base');
  const relative=saved.path.replace(/^game_libraries\//,'');const file=path.join(f.root,relative);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),f.result.buckets);
  const manifest=JSON.parse(await fs.readFile(path.join(path.dirname(file),'manifest.json'),'utf8'));
  assert.equal(manifest.mode,'base');assert.equal(manifest.multiplierUnit,'raw-before-line-count');assert.equal(manifest.partial,false);assert.equal(manifest.configHash.length,64);
  const second=await f.store.save('AG1','a'.repeat(64),f.result,'base');assert.notEqual(saved.path,second.path);
  await assert.rejects(f.store.save('../bad','a'.repeat(64),f.result,'base'));
  await assert.rejects(f.store.save('AG1','a'.repeat(64),f.result,'free'),/模式/);
  f.change();await assert.rejects(f.store.save('AG1','a'.repeat(64),f.result,'base'),/改变/);
});
test('library endpoint saves valid results and rejects cross-site requests',async t=>{
  const f=await serverFixture(t),middleware=createGameMiddleware({},f.boardStore,f.store);
  const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/__game-files/games/AG1/library/base`;
  const response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:'a'.repeat(64),file:f.result})});assert.equal(response.status,200);assert.ok((await response.json()).path.endsWith('/library.json'));
  const denied=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json',Origin:'http://evil.invalid'},body:'{}'});assert.equal(denied.status,403);
  assert.equal((await fetch(url)).status,405);
});

test('library audit counts winning symbols only in positively weighted buckets',()=>{
 const value={buckets:{
  2:[[3,0,1,2,1,4,1,0]],
  1:[[3,0,3,2,3,4,3,0]],
 }};
 const audit=library.auditLibrary(value,config(),[[2,1],[1,0],[4,1]]);
 assert.equal(audit.ready,false);
 assert.deepEqual(audit.missingMultipliers,['4']);
 assert.equal(audit.symbolWins.find(row=>row.id==='1').records,1);
 assert.equal(audit.symbolWins.find(row=>row.id==='3').records,0);
 const complete=library.auditLibrary(value,config(),[[2,1],[1,1]]);
 assert.equal(complete.ready,true);
 assert.equal(complete.requiredMultipliers,2);
});
