import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createTigerLibraryStore} from '../server/tiger-library.mjs';
test('skeletons save separately as base/free buckets, with coverage and double revision checks',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tiger-store-'));let revision='a'.repeat(64),gameRevision='b'.repeat(64),audits=0;
 const config={lines:[1,2,3,4,5]},paylines={read:async()=>({revision,file:config})},game={read:async()=>({revision:gameRevision,files:{config:{ruleType:'paylines_v1',parameters:{lineCount:5}},base:[[3,1]],free:[[150,1]]}})};
 const store=createTigerLibraryStore(root,paylines,game,(value,c)=>{audits++;assert.equal(c,config);if(value.bad)throw new Error('invalid skeleton');},()=>({required:1,covered:0,missing:['3']}));
 const value={mode:'base',gameRevision,stats:{retained:1,generated:1},options:{mode:'base',count:1},partial:false,buckets:{3:[{target:null,stages:[[1,1,4,1,7,1]]}]}};
 try{
  const a=await store.save('AG4',revision,value),b=await store.save('AG4',revision,{...value,mode:'free'});assert.ok(a.path.includes('/base/'));assert.ok(b.path.includes('/free/'));assert.equal(a.retained,1);assert.equal(audits,2);
  const entries=await fs.readdir(path.join(root,'AG4','base')),folder=path.join(root,'AG4','base',entries[0]);assert.deepEqual(JSON.parse(await fs.readFile(path.join(folder,'library.json'))),value.buckets);
  const manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json')));assert.equal(manifest.format,'payline-skeleton-v1');assert.equal(manifest.paylineRevision,revision);assert.equal(manifest.gameRevision,gameRevision);assert.deepEqual(manifest.validation.missing,['3']);
  gameRevision='c'.repeat(64);await assert.rejects(()=>store.save('AG4',revision,value),e=>e.status===409);gameRevision=value.gameRevision;revision='d'.repeat(64);await assert.rejects(()=>store.save('AG4','a'.repeat(64),value),e=>e.status===409);
  await assert.rejects(()=>store.save('../escape',revision,value),e=>e.status===400);await assert.rejects(()=>store.save('AG4',revision,{...value,bad:true}),e=>e.status===422);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('full-round route uses local-only middleware and passes exact file/revision',async()=>{
 const {createGameMiddleware}=await import('../server/game-files.mjs');const {createServer}=await import('node:http');let saves=0;
 const middleware=createGameMiddleware({},null,null,null,{save:async(game,revision,file)=>{assert.equal(game,'AG4');assert.equal(revision,'rev');assert.deepEqual(file,{skeleton:true});saves++;return {retained:1};}});
 const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/__game-files/games/AG4/paylines/library`;
 try{const good=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:'rev',file:{skeleton:true}})});assert.equal(good.status,200);assert.equal(saves,1);assert.equal((await fetch(url)).status,405);const cross=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:'{}'});assert.equal(cross.status,403);assert.equal(saves,1);}finally{await new Promise(resolve=>server.close(resolve));}
});
