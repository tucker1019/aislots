import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createOxLibraryStore} from '../server/ox-library.mjs';
import {createGameStore} from '../server/game-files.mjs';
import {settings} from './helpers/settings.mjs';
test('AG7 numerical files save independently, persist tuning and reject stale or invalid writes',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ox-game-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.cp(new URL('../../game_configs/AG7',import.meta.url),path.join(root,'AG7'),{recursive:true});
 const store=createGameStore(root,settings.validateGameFiles),doc=await store.read('AG7'),files=structuredClone(doc.files);files.config.parameters.baseSpinWinProbability=.3;files.base.at(-1)[1]=1;
 const saved=await store.save('AG7',doc.revision,files);assert.notEqual(saved.revision,doc.revision);assert.deepEqual((await store.read('AG7')).files,files);
 await assert.rejects(()=>store.save('AG7',doc.revision,doc.files),e=>e.status===409);
 files.config.parameters.freeSpinWinProbability=.5;await assert.rejects(()=>store.save('AG7',saved.revision,files),e=>e.status===422);assert.equal((await store.read('AG7')).revision,saved.revision);
});
test('AG7 candidates are immutable pure final-board buckets with both revisions and coverage',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ox-library-'));let revision='a'.repeat(64),gameRevision='b'.repeat(64),reads=0,changeDuringSave=false;
 const config={ruleType:'fortune_ox_v1'},numerical={ruleType:'fortune_ox_v1',parameters:{lineCount:10}};
 const paylines={read:async()=>({revision,file:config})},game={read:async()=>{reads++;return {revision:changeDuringSave&&reads%2===0?'c'.repeat(64):gameRevision,files:{config:numerical,base:[[3,1],[5,1]],free:[[3,1]]}};}};
 const store=createOxLibraryStore(root,paylines,game,(v,c)=>{assert.equal(c,config);if(v.bad)throw Error('坏骨架');},()=>({required:2,covered:1,missing:['5']}));
 const value={format:'ox-skeleton-v1',mode:'free',gameRevision,config,options:{count:1},targets:[3],stats:{generated:1,retained:1},partial:false,buckets:{3:[{cells:[0,1,3,7,4,7,5,7,6,1]}]}};
 try{
  const a=await store.save('AG7',revision,value),b=await store.save('AG7',revision,value);assert.notEqual(a.path,b.path);assert.equal(a.validation.covered,1);
  const dir=path.dirname(path.join(root,a.path.replace(/^game_libraries\//,''))),data=await fs.readFile(path.join(dir,'library.json'),'utf8'),manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  assert.deepEqual(JSON.parse(data),value.buckets);assert.deepEqual(manifest.numericalConfig,numerical);assert.equal(manifest.candidate,true);assert.equal(manifest.unit,'one-final-winning-feature-board');assert.equal(manifest.dataHash,createHash('sha256').update(data).digest('hex'));assert.equal(manifest.gameRevision,gameRevision);assert.equal(manifest.paylineRevision,revision);assert.equal(Object.hasOwn(JSON.parse(data),'0'),false);
  await assert.rejects(()=>store.save('AG7','d'.repeat(64),value),e=>e.status===409);gameRevision='e'.repeat(64);await assert.rejects(()=>store.save('AG7',revision,value),e=>e.status===409);gameRevision=value.gameRevision;
  await assert.rejects(()=>store.save('AG7',revision,{...value,bad:true}),e=>e.status===422);
  changeDuringSave=true;reads=0;await assert.rejects(()=>store.save('AG7',revision,value),e=>e.status===409);assert.equal((await fs.readdir(path.join(root,'AG7/free'))).length,2);
  await assert.rejects(()=>store.save('../outside',revision,value),e=>e.status===400);
  changeDuringSave=false;await fs.symlink(path.join(root,'AG7'),path.join(root,'LINK'));await assert.rejects(()=>store.save('LINK',revision,value),e=>e.status===400);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
