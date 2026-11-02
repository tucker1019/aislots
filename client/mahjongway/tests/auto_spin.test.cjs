const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {AutoSpinRunner}=require('../assets/mahjongway/src/slots/auto_spin_runner.ts');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
test('each complete paid/free/cascade chain consumes one count and stops at zero',async()=>{
 let spins=0,pauses=0;const runner=new AutoSpinRunner(async()=>{spins++;return true;},async()=>{pauses++;},()=>true,()=>{});
 runner.start(3);await flush();assert.equal(spins,3);assert.equal(pauses,2);assert.equal(runner.remaining,0);assert.equal(runner.active,false);
});
test('stop during the whole current game never decrements below zero or starts another',async()=>{
 const current=deferred();let spins=0;const runner=new AutoSpinRunner(()=>{spins++;return current.promise;},async()=>{},()=>true,()=>{});
 runner.start(3);assert.equal(runner.remaining,3);runner.stop();current.resolve(true);await flush();
 assert.equal(spins,1);assert.equal(runner.remaining,0);assert.equal(runner.active,false);
});
test('stop during the interval prevents the next spin; old timer cannot modify a new task',async()=>{
 let spins=0;const pauses=[];
 const runner=new AutoSpinRunner(async()=>{spins++;return true;},()=>{const p=deferred();pauses.push(p);return p.promise;},()=>true,()=>{});
 runner.start(2);assert.equal(runner.start(5),false);await flush();
 assert.equal(runner.remaining,1);runner.stop();assert.equal(runner.start(3),true);await flush();
 pauses[0].resolve();await flush();assert.equal(spins,2);assert.equal(runner.remaining,2);assert.equal(runner.active,true);
 runner.stop();pauses[1].resolve();await flush();assert.equal(spins,2);assert.equal(runner.remaining,0);
});
test('failed spin stops automatic mode; invalid counts and busy scene cannot start',async()=>{
 let spins=0;const runner=new AutoSpinRunner(async()=>{spins++;return false;},async()=>{},()=>true,()=>{});
 for(const n of [0,-1,NaN,Infinity,1.5,1001])assert.equal(runner.start(n),false);
 runner.start(10);await flush();assert.equal(spins,1);assert.equal(runner.active,false);
 assert.equal(new AutoSpinRunner(async()=>true,async()=>{},()=>false,()=>{}).start(10),false);
});
test('native auto-stop prefab includes the original counter and no source business callbacks',()=>{
 const path=require('node:path');
 const nodes=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/resources/mahjong_effects/control_autostop.prefab'),'utf8'));
 assert.ok(nodes.some(node=>node._name==='lab_autoNum'));
 for(const node of nodes){
  assert.ok(node.__type__.startsWith('cc.'));
  if(node.__type__==='cc.Button')assert.deepEqual(node.clickEvents,[]);
 }
});
test('auto-stop prefab has complete editor node/component ownership metadata',()=>{
 const path=require('node:path');
 const nodes=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/resources/mahjong_effects/control_autostop.prefab'),'utf8'));
 const root=nodes[0].data.__id__,ids=new Set();
 for(const node of nodes){
  if(node.__type__==='cc.Node'){
   assert.equal(node._objFlags,0);
   assert.ok(node._prefab,'editor requires PrefabInfo for every node');
   const info=nodes[node._prefab.__id__];assert.equal(info.__type__,'cc.PrefabInfo');
   assert.equal(info.root.__id__,root);assert.equal(info.asset.__id__,0);
   assert.ok(info.fileId);assert.equal(ids.has(info.fileId),false);ids.add(info.fileId);
  }else if(node.node){
   assert.ok(node.__prefab,'editor requires component ownership');
   const info=nodes[node.__prefab.__id__];assert.equal(info.__type__,'cc.CompPrefabInfo');
   assert.ok(info.fileId);assert.equal(ids.has(info.fileId),false);ids.add(info.fileId);
  }
 }
});
