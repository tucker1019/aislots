import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from '../../../slot_math/node_modules/typescript/lib/typescript.js';
const root=new URL('../',import.meta.url);
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
test('only the directly runnable game scene remains, with no custom bundle',()=>{
 const assets=new URL('assets/',root);
 const scenes=files(assets.pathname).filter(p=>p.endsWith('.scene'));
 assert.equal(scenes.length,1);
 const config=JSON.parse(fs.readFileSync(new URL('buildConfig_web-mobile.json',root)));
 assert.equal(config.scenes.length,1);
 assert.equal(config.startScene,JSON.parse(fs.readFileSync(scenes[0]+'.meta')).uuid);
 assert.equal(config.scenes[0].inBundle,false);
 const custom=JSON.parse(fs.readFileSync(new URL('assets/wildbountyshowdown.meta',root))).userData;
 assert.notEqual(custom.isBundle,true);
 for(const file of files(assets.pathname).filter(p=>p.endsWith('.ts')))
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/loadBundle|getBundle|BUNDLENAME|loadScene\(/,file);
 assert.equal(fs.existsSync(new URL('assets/resources/res/load/prefab/com/AlertLayer.prefab',root)),false);
});
async function bootstrap(){
 const file=new URL('assets/wildbountyshowdown/src/network/scene_bootstrap.ts',root);
 const code=ts.transpile(fs.readFileSync(file,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
 return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).bootstrapScene;
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('single scene waits for both session and resources regardless of completion order',async()=>{
 const start=await bootstrap();
 for(const order of [[0,1],[1,0]]){
  const pending=[deferred(),deferred()];let activated=0;
  const running=start({session:()=>pending[0].promise,resources:()=>pending[1].promise,isAlive:()=>true,ready:()=>activated++});
  pending[order[0]].resolve();await Promise.resolve();assert.equal(activated,0);
  pending[order[1]].resolve();await running;assert.equal(activated,1);
 }
});
test('failed loading or a destroyed scene never activates gameplay',async()=>{
 const start=await bootstrap();let activated=0;
 await assert.rejects(start({session:async()=>{},resources:async()=>{throw Error('resource failed');},isAlive:()=>true,ready:()=>activated++}),/resource failed/);
 await start({session:async()=>{},resources:async()=>{},isAlive:()=>false,ready:()=>activated++});
 assert.equal(activated,0);
});
