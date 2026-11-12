const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('../../../slot_math/node_modules/typescript');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/mahjongway2/src/effects/free_dragon.ts'),'utf8');
function setup(){
 const events=[];const children=[];const outerChildren=[];
 function node(name,list){const n={name,active:false,isValid:true,position:{x:0,y:0,z:0,clone(){return {...this}}},setPosition(){},getSiblingIndex(){return list.indexOf(n)},setSiblingIndex(i){list.splice(list.indexOf(n),1);list.splice(i,0,n)},getComponent(){return /^r[1-5]$/.test(name)?{}:null}};list.push(n);return n;}
 const outer={children:outerChildren,getChildByName(name){return outerChildren.find(n=>n.name===name)}};
 const parent={children,parent:outer,position:{x:0,y:101,z:0},getSiblingIndex(){return outerChildren.indexOf(parent)},getChildByName(name){return children.find(n=>n.name===name)}};outerChildren.push(parent);node('static_img',outerChildren);
 const reels=['r1','r2','r3','r4','r5'].map(name=>node(name,children));
 const effects=[];
 const library={create(name,host){const n=node(name,host.children);effects.push(n);return{node:n,reset(){n.active=true;},play(clip){events.push(clip)},hide(){n.active=false;},destroy(){n.isValid=false}}}};
 const sandbox={exports:{},require:()=>({EffectLibrary:library})};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,sandbox);
 const effect=new sandbox.exports.FreeDragon(parent,()=>events.push('sound'),()=>events.push('stop'));return {effect,events,children:effects,parent,outer,reels};
}
test('飞龙分阶段播放，结束后隐藏并完成等待',async()=>{const {effect,events,children}=setup();effect.visible(true);assert.equal(children[0].active,true);const done=effect.play();effect.update(.8);assert.equal(children[2].active,true);effect.update(.5);assert.ok(events.includes('dragon_free_start2'));effect.update(1.1);await done;assert.ok(children.slice(1).every(n=>!n.active));assert.equal(children[0].active,true);});
test('退出免费中断演出，等待仍结束且不会继续播放后续片段',async()=>{const {effect,events,children}=setup();const done=effect.play();effect.visible(false);await done;effect.update(5);assert.ok(!events.includes('dragon_free_start2'));assert.ok(children.every(n=>!n.active));effect.destroy();assert.ok(children.every(n=>!n.isValid));});

test('飞龙在外层装饰之上，第三列在遮罩之上，结束恢复转轴顺序',async()=>{const {effect,parent,outer,reels}=setup();const before=parent.children.slice();const dragon=outer.getChildByName('dragon');assert.ok(outer.children.indexOf(dragon)>outer.children.indexOf(outer.getChildByName('static_img')));const done=effect.play();effect.update(.8);assert.deepEqual(parent.children.slice(-7).map(n=>n.name),['r5','r4','r2','r1','dragon_mask','r3','mj_fly']);effect.cancel();await done;assert.deepEqual(parent.children,before);});

test('免费开转时五列先滚动，飞龙结束才送入停轴结果，中断不落盘',async()=>{
 const base=fs.readFileSync(path.join(__dirname,'../assets/mahjongway2/src/slots/slots_base.ts'),'utf8');
 const start=base.indexOf('                if (!this.reels.some((r) => r.state !== 0))');
 const end=base.indexOf('                this.anticipation?.begin(',start);
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('frame','previous','strips','running',base.slice(start,end));
 for(const interrupted of [false,true]){
  let resolve,stopped=0,queued=0;
  const reels=Array.from({length:5},()=>({state:0,startRoll(){this.state=2},stopRoll(){stopped++}}));
  const gate=new Promise(r=>resolve=r);
  const flow={reels,effects:{spinSound(){},queueFreeDragon(){queued++},playFreeDragon(){assert.ok(reels.every(r=>r.state===2));return gate}}};
  const done=run.call(flow,{mode:'free'},{mode:'base'},[[],[],[],[],[]],()=>!interrupted);
  assert.equal(stopped,0);assert.equal(queued,1);resolve();await done;assert.equal(stopped,interrupted?0:5);
 }
});
