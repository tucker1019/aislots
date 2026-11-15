import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {createRabbitLibraryStore} from '../server/rabbit-library.mjs';
test('AG5 candidate storage keeps pure per-spin buckets and both configuration revisions',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rabbit-library-'));let revision='a'.repeat(64),gameRevision='b'.repeat(64),reads=0,changeDuringSave=false;
 const config={ruleType:'fortune_rabbit_v1'},numerical={ruleType:'fortune_rabbit_v1',parameters:{lineCount:10,featureSpins:8,maxWinMultiplier:5000}};
 const paylines={read:async()=>({revision,file:config})},game={read:async()=>{reads++;return {revision:changeDuringSave&&reads%2===0?'c'.repeat(64):gameRevision,files:{config:numerical,base:[[100,1],[200,1]],free:[[25,1]]}};}};
 const store=createRabbitLibraryStore(root,paylines,game,(v,c)=>{assert.equal(c,config);if(v.bad)throw Error('坏骨架');},()=>({required:2,covered:1,missing:['200']}));
 const value={format:'rabbit-skeleton-v1',mode:'base',gameRevision,config,options:{count:1},stats:{generated:1,retained:1},partial:false,buckets:{100:[{cells:[0,6,3,6,7,6]}]}};
 try{
  const a=await store.save('AG5',revision,value),b=await store.save('AG5',revision,value);assert.notEqual(a.path,b.path);assert.equal(a.validation.covered,1);
  const dir=path.dirname(path.join(root,a.path.replace(/^game_libraries\//,''))),data=await fs.readFile(path.join(dir,'library.json'),'utf8'),manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  assert.deepEqual(JSON.parse(data),value.buckets);assert.deepEqual(manifest.numericalConfig,numerical);assert.equal(manifest.candidate,true);assert.equal(manifest.unit,'one-winning-normal-spin');assert.equal(manifest.dataHash,createHash('sha256').update(data).digest('hex'));assert.equal(manifest.gameRevision,gameRevision);
  await assert.rejects(()=>store.save('AG5','d'.repeat(64),value),e=>e.status===409);gameRevision='e'.repeat(64);await assert.rejects(()=>store.save('AG5',revision,value),e=>e.status===409);gameRevision=value.gameRevision;
  await assert.rejects(()=>store.save('AG5',revision,{...value,bad:true}),e=>e.status===422);
  changeDuringSave=true;reads=0;await assert.rejects(()=>store.save('AG5',revision,value),e=>e.status===409);assert.equal((await fs.readdir(path.join(root,'AG5/base'))).length,2);
  await assert.rejects(()=>store.save('../outside',revision,value),e=>e.status===400);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
