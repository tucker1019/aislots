import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createGameStore,createPaylineStore} from '../server/game-files.mjs';
import {createTigerLibraryStore} from '../server/tiger-library.mjs';
import {loadTypeScript} from './helpers/typescript.mjs';
const {validateGameFiles}=loadTypeScript(new URL('../src/domain/settings.ts',import.meta.url));
const {validatePaylines}=loadTypeScript(new URL('../src/domain/paylines.ts',import.meta.url));
const {LeopardSkeletonGenerator}=loadTypeScript(new URL('../src/domain/leopardSkeleton.ts',import.meta.url));
const {validateTigerSkeletonLibrary,tigerCoverage}=loadTypeScript(new URL('../src/domain/tigerSkeleton.ts',import.meta.url));
test('AG9 candidate save validates every skeleton, records complete coverage and rejects stale files',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ag9-files-')),configs=path.join(root,'configs'),libraries=path.join(root,'libraries');
 try{
  await fs.mkdir(path.join(configs,'AG9'),{recursive:true});
  for(const name of ['base.json','free.json','config.json','paylines.json'])await fs.copyFile(new URL('../../game_configs/AG9/'+name,import.meta.url),path.join(configs,'AG9',name));
  const gameStore=createGameStore(configs,validateGameFiles),boardStore=createPaylineStore(configs,validatePaylines),store=createTigerLibraryStore(libraries,boardStore,gameStore,validateTigerSkeletonLibrary,tigerCoverage),game=await gameStore.read('AG9'),board=await boardStore.read('AG9');
  const g=new LeopardSkeletonGenerator(board.file,{mode:'free',count:118098,seed:1021,perMultiplier:1,maxRetained:15000});while(!g.done)g.step();
  const value={...g.result(),gameRevision:game.revision},saved=await store.save('AG9',board.revision,value);assert.equal(saved.validation.covered,25);assert.deepEqual(saved.validation.missing,[]);
  const folder=path.join(libraries,'AG9','free',(await fs.readdir(path.join(libraries,'AG9','free')))[0]),manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'))),library=JSON.parse(await fs.readFile(path.join(folder,'library.json')));
  assert.equal(manifest.candidate,true);assert.equal(manifest.config.feature.type,'fortune_leopard_v1');assert.equal(library['0'],undefined);
  const bad=structuredClone(value);Object.values(bad.buckets)[0][0].stages[0][1]=999;
  await assert.rejects(()=>store.save('AG9',board.revision,bad),e=>e.status===422);
  const changed=structuredClone(game.files);changed.config.parameters.freeSpinTriggerProbability=.02;await gameStore.save('AG9',game.revision,changed);
  await assert.rejects(()=>store.save('AG9',board.revision,value),e=>e.status===409);
  assert.equal((await fs.readdir(path.join(libraries,'AG9','free'))).length,1);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
