const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText,f);
const requests=[];
const cc={Component:class{},_decorator:{ccclass:()=>c=>c,property:()=>{}},Color:{YELLOW:{}},Node:class{static EventType={TOUCH_END:'touch-end'}},resources:{load(p,type,callback){requests.push(p);callback(null,{addRef(){return this},decRef(){}})}},Prefab:class{}};
const original=Module._load;
Module._load=function(id,...args){if(id==='cc')return cc;return original.call(this,id,...args)};
const {EffectLibrary}=require('../assets/mahjongway2/src/effects/effect_library.ts');
const {GameEffects}=require('../assets/mahjongway2/src/effects/game_effects.ts');
Module._load=original;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const flush=()=>new Promise(r=>setImmediate(r));
test('startup excludes free-only prefabs; explicit free load reports completion',async()=>{
 requests.length=0;EffectLibrary.prefabs.clear();await EffectLibrary.load();
 for(const name of ['panel_free','bonus_bg_particle','pop_free_again','pop_free_end'])assert.equal(requests.some(p=>p.endsWith('/'+name)),false,name);
 let progress=0;const assets=await EffectLibrary.loadFree(()=>progress++);
 assert.equal(progress,4);assert.equal(assets.length,4);
});
test('free preparation shares one request and cleans up an obsolete pending load',async()=>{
 const old=EffectLibrary.loadFree;const wait=deferred();let refs=1,created=0;
 try{
  EffectLibrary.loadFree=()=>wait.promise;
  const fx=new GameEffects();fx.audio={freeAssetCount:0,loadFree:async()=>{},releaseFree(){}};fx.createFreeViews=()=>created++;
  const first=fx.prepareFree();assert.equal(first,fx.prepareFree());
  fx.releaseFree();wait.resolve([{name:'panel_free',asset:{decRef(){refs--}}}]);await first;
  assert.equal(refs,0);assert.equal(created,0);assert.equal(EffectLibrary.prefabs.has('panel_free'),false);
 }finally{EffectLibrary.loadFree=old}
});
test('trigger page waits for assets before showing its start button',async()=>{
 const fx=new GameEffects(),wait=deferred();const button={active:true},spinner={active:false,setRotationFromEuler(){}},label={string:''},labelNode={active:false,getComponent:()=>label};
 spinner.parent={getChildByName:()=>labelNode};
 const paths={'panel/cnt':{getComponent:()=>({string:''})},'panel/button':button,'panel/bonus_lading':spinner};
 let scheduled,progress;
 fx.scheduleOnce=fn=>{scheduled=fn};fx.sound=()=>{};fx.popup=(name,setup)=>{fx.popupFinish=()=>{};setup({node:{getChildByPath:p=>paths[p]},play(){}});return wait.promise};
 fx.prepareFree=cb=>{progress=cb;return wait.promise};
 fx.intro(12);assert.equal(button.active,false);assert.equal(spinner.active,true);assert.equal(label.string,'0%');
 assert.equal(typeof scheduled,'function');scheduled();progress(50);assert.equal(label.string,'50%');assert.equal(button.active,false);
 wait.resolve();await flush();assert.equal(button.active,true);assert.equal(spinner.active,false);assert.equal(labelNode.active,false);
});
test('failed preparation is retryable and a completed load releases owned assets',async()=>{
 const old=EffectLibrary.loadFree;let attempts=0,refs=1,released=0,created=0;
 try{
  const asset={decRef(){refs--}};
  EffectLibrary.loadFree=async progress=>{attempts++;if(attempts===1)throw Error('network');progress();return[{name:'panel_free',asset}]};
  const fx=new GameEffects();fx.audio={freeAssetCount:0,loadFree:async()=>{},releaseFree(){released++}};fx.createFreeViews=()=>created++;
  await assert.rejects(fx.prepareFree(),/加载失败/);const progress=[];
  await fx.prepareFree(percent=>progress.push(percent));assert.equal(created,1);assert.equal(EffectLibrary.prefabs.get('panel_free'),asset);
  fx.releaseFree();assert.equal(refs,0);assert.equal(released,1);assert.equal(EffectLibrary.prefabs.has('panel_free'),false);
 }finally{EffectLibrary.loadFree=old}
});
test('free-only audio is excluded from startup preload and loaded and released on demand',async()=>{
 const {GameAudio}=require('../assets/mahjongway2/src/audio/game_audio.ts');let startup,loaded,released,count=0;
 const audio=new GameAudio({setMuted(){},attach(){},preload(names){startup=names},load:async(names,progress)=>{loaded=names;names.forEach(progress)},release(names){released=names}});
 audio.initialize();assert.equal(startup.includes('bgm_fs'),false);assert.equal(startup.includes('games/bgmBonusIntro'),false);assert.equal(startup.includes('bgm_mg'),true);
 await audio.loadFree(()=>count++);assert.equal(count,audio.freeAssetCount);assert.ok(loaded.includes('bgm_fs'));audio.releaseFree();assert.deepEqual(released,loaded);
});
test('free particle scene host carries no eager animation or image dependencies',()=>{
 const scene=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/mahjongway2/mahjongway2.scene'),'utf8'));
 const host=scene.find(item=>item.__type__==='cc.Node'&&item._name==='bonus_bg_particle');assert.ok(host);
 const components=host._components.map(ref=>scene[ref.__id__]);assert.ok(components.some(item=>item.__type__==='cc.UITransform'));
 assert.equal(components.find(item=>item.__type__==='cc.Sprite')._spriteFrame,null);assert.deepEqual(components.find(item=>item.__type__==='cc.Animation')._clips,[]);
});
test('trigger load failure keeps entry gated and allows retry',async()=>{
 const fx=new GameEffects(),first=deferred(),second=deferred();const button={active:true},label={string:''},labelNode={active:false,getComponent:()=>label},spinner={active:false,setRotationFromEuler(){},parent:{getChildByName:()=>labelNode}};
 const paths={'panel/cnt':{getComponent:()=>({string:''})},'panel/button':button,'panel/bonus_lading':spinner};let scheduled,attempt=0;
 fx.sound=()=>{};fx.scheduleOnce=fn=>scheduled=fn;fx.popup=(name,setup)=>{fx.popupFinish=()=>{};setup({node:{getChildByPath:p=>paths[p]},play(){}})};
 fx.prepareFree=()=>++attempt===1?first.promise:second.promise;
 fx.intro(12);scheduled();first.reject(Error('network'));await flush();assert.equal(button.active,false);assert.equal(spinner.active,false);assert.match(label.string,/重试/);
 assert.equal(fx.dismiss(),true);assert.equal(attempt,2);second.resolve();await flush();assert.equal(button.active,true);
});
