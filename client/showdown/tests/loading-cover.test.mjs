import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const root=new URL('../',import.meta.url);
function harness(search=''){
 const listeners=new Map(),elements={};for(const id of ['AG3LoadingCover','AG3StartButton','AG3LoadingProgress','AG3LoadingFill'])elements[id]={hidden:true,style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this[k]=fn;},remove(){this.removed=true;}};
 const window={location:{search},addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);},dispatchEvent(e){listeners.get(e.type)?.(e);}};
 vm.runInNewContext(fs.readFileSync(new URL('build-templates/web-mobile/loading/cover.js',root),'utf8'),{window,document:{getElementById:id=>elements[id]},URLSearchParams,Event:class{constructor(type){this.type=type;}}});
 return{window,elements,emit:(type,detail)=>window.dispatchEvent({type,detail})};
}
test('HTML cover waits for game readiness and explicit start; no image-load dismissal',()=>{
 const h=harness();h.emit('aislots-loading-progress',{progress:60});h.emit('aislots-loading-progress',{progress:20});
 assert.equal(h.elements.AG3LoadingProgress.attrs['aria-valuenow'],'60');assert.equal(h.elements.AG3LoadingCover.removed,undefined);
 h.emit('aislots-board-ready');assert.equal(h.elements.AG3StartButton.hidden,false);assert.equal(h.elements.AG3LoadingCover.removed,undefined);
 let starts=0;h.window.addEventListener('aislots-started',()=>starts++);h.elements.AG3StartButton.click();h.elements.AG3StartButton.click();
 assert.equal(starts,1);assert.equal(h.elements.AG3LoadingCover.removed,undefined);h.emit('aislots-game-revealed');assert.equal(h.elements.AG3LoadingCover.removed,true);
});
test('public replay starts only after readiness',()=>{const h=harness('?replay=id&share=token');let starts=0;h.window.addEventListener('aislots-started',()=>starts++);assert.equal(starts,0);h.emit('aislots-board-ready');assert.equal(starts,1);assert.equal(h.elements.AG3LoadingCover.removed,undefined);h.emit('aislots-game-revealed');assert.equal(h.elements.AG3LoadingCover.removed,true);});
test('preview and build use identical engine-independent assets',()=>{
 for(const name of ['cover.js','opening.js','cover.css','loading_bg_en.jpg','loading_jdt1.png','loading_jdt2.png'])assert.deepEqual(fs.readFileSync(new URL('preview-template/loading/'+name,root)),fs.readFileSync(new URL('build-templates/web-mobile/loading/'+name,root)));
 const scene=fs.readFileSync(new URL('assets/wildbountyshowdown/src/wbsgame/view/WBSGameLayer.ts',root),'utf8');assert.doesNotMatch(scene,/instantiate\(this.loadingPagePrefab\)/);assert.match(scene,/Director.EVENT_AFTER_DRAW/);
});

test('AG opening waits at least one second and actual scene render before fading',()=>{
 const handlers=new Map(),timers=[],frames=[];let removed=false;
 const logo={style:{}},opening={style:{},querySelector:()=>logo,remove(){removed=true;}},cover={getBoundingClientRect:()=>({left:0,top:0,width:140,height:250})};
 const window={addEventListener:(k,fn)=>handlers.set(k,fn),removeEventListener:k=>handlers.delete(k)};
 vm.runInNewContext(fs.readFileSync(new URL('build-templates/web-mobile/loading/opening.js',root),'utf8'),{window,document:{getElementById:id=>id==='AGOpening'?opening:cover},requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>timers.push({fn,ms})});
 assert.equal(opening.style.opacity,undefined);frames.shift()();assert.equal(timers[0].ms,1000);timers.shift().fn();assert.equal(opening.style.opacity,undefined);
 handlers.get('aislots-scene-rendered')();assert.equal(opening.style.opacity,'0');assert.equal(removed,false);assert.equal(timers[0].ms,300);timers.shift().fn();assert.equal(removed,true);assert.ok(Math.abs(parseFloat(logo.style.width)-81.2)<0.001);
});

test('wide lobby preview never forces a portrait rotation on mobile',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('buildConfig_web-mobile.json',root),'utf8'));
 assert.equal(config.packages['web-mobile'].orientation,'auto');
});
