const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');
const ts=require('../../../slot_math/node_modules/typescript');
const root=path.join(__dirname,'../assets/mahjongway/src');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText,file);
const original=Module._load;Module._load=function(id,...args){if(id==='cc')return {Component:class{},_decorator:{ccclass:()=>c=>c,property:()=>{}},Color:{YELLOW:{}},Node:class{},UIOpacity:class{}};if(id==='cc/env')return {DEBUG:false,DEV:false};return original.call(this,id,...args)};
const {GameApi}=require(path.join(root,'network/game/game_api.ts'));
const {serverStrips,gravitySources}=require(path.join(root,'slots/server_board.ts'));
const {slots_r:Reel}=require(path.join(root,'slots/slots_r.ts'));
const identity={appname:'p',appkey:'a',uid:'u',gameId:'AG1',test:true};
test('lost spin response retries same server nonce and amount; success advances nonce',async()=>{
 const calls=[];let fail=true;const api=new GameApi('',identity,async(route,body)=>{calls.push([route,body&&{...body}]);if(route==='/login')return {accessToken:'t',balance:'500000'};if(route.endsWith('/state'))return {requestId:'server-1',hasNext:false};if(fail){fail=false;throw Error('timeout')}return {nextRequestId:'server-2'}});
 await api.login();await assert.rejects(api.spin('200'),/timeout/);await api.spin('900');await api.spin('300');
 assert.deepEqual(calls.filter(c=>c[0].endsWith('/spin')).map(c=>c[1]),[{requestId:'server-1',betAmount:'200'},{requestId:'server-1',betAmount:'200'},{requestId:'server-2',betAmount:'300'}]);
});
test('fresh reconnect uses state nonce, never fetches/replays settled response',async()=>{
 const routes=[];const api=new GameApi('',identity,async(route)=>{routes.push(route);if(route.endsWith('/state'))return {requestId:'next-unsettled',hasNext:true,betAmount:'200'};return {nextRequestId:'after'}});
 const state=await api.state();await api.spin(state.betAmount);assert.deepEqual(routes,['/games/AG1/state','/games/AG1/spin']);
});
test('preview + active rows stay top-down; decoration retained; gravity follows stable cell IDs',()=>{
 const board=Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>({id:c*5+r+1,symbolId:2})));
 const old=serverStrips(board,()=>8);const next=serverStrips(board,()=>{throw Error('decoration re-randomized')},old);assert.deepEqual(next[0],[8,7,7,7,7,7,8]);
 assert.deepEqual(gravitySources([[{id:1},{id:2},{id:3},{id:4},{id:5}]],[[{id:6},{id:7},{id:1},{id:3},{id:5}]]),[[-2,-1,0,2,4]]);
 assert.throws(()=>serverStrips([board[0]],()=>1),/5列/);
});
function makeReel(column){const cells=Array.from({length:7},(_,i)=>({position:{y:165-i*165},active:true,value:1,setPosition(_x,y){this.position.y=y},setSiblingIndex(){},getComponent(){return this.component},component:{playScatterStop(){},setBlur(){},setCellValue(v){cells[i].value=v}}}));const r=new Reel();r.node={children:cells};r.index=column;r.slots={boards:[]};r.bindPicker();return {r,cells}}
for(const fps of [30,60,120])for(const forced of [false,true])test(`Cocos reel exact results at ${fps}FPS with ${forced?'forced':'natural'} stop`,()=>{
 for(let column=0;column<5;column++){const {r,cells}=makeReel(column);r.startRoll();for(let i=0;i<fps*2;i++)r.tick(1/fps);r.stopRoll([1,2,3,4,5,6,7]);for(let i=0;i<fps*20&&r.state;i++){r.tick(1/fps);if(forced&&r.state===3){r.stop();break}}assert.equal(r.state,0);assert.deepEqual([...cells].sort((a,b)=>b.position.y-a.position.y).map(n=>n.value),[1,2,3,4,5,6,7]);if(forced)assert.equal(r.settleAnchor,-1)}
});
test('cascade shares one acceleration curve; unchanged cells and guards do not move',()=>{const {r,cells}=makeReel(0);r.dropTo([9,1,2,3,4,5,9],[-2,-1,0,3,4]);const y=cells.map(n=>n.position.y);r.tick(.05);const distance=y[1]-cells[1].position.y;assert.ok(distance>0);for(const i of [1,2,3])assert.equal(y[i]-cells[i].position.y,distance);for(const i of [0,4,5,6])assert.equal(y[i],cells[i].position.y);for(let i=0;i<120;i++)r.tick(1/60);assert.equal(r.state,0);assert.deepEqual(cells.map(n=>n.position.y),[165,0,-165,-330,-495,-660,-825])});
const {slots_base:Flow}=require(path.join(root,'slots/slots_base.ts'));
function flow(){const f=new Flow();f.node={emit(){},parent:{getComponentsInChildren(){return []}}};f.status={string:''};f.ready=true;f.initializeCells=(strips)=>{f.boards=strips};f.reels=Array.from({length:5},()=>({state:0,startRoll(){this.state=1},stopRoll(){this.state=0},stop(){this.state=0},tick(){}}));f.picks=Array.from({length:5},()=>()=>1);return f}
test('request failure restores controls and stops every reel instead of polling forever',async()=>{const f=flow();f.api={spin:async()=>{throw Error('timeout')}};const log=console.error;console.error=()=>{};try{await f.spin()}finally{console.error=log}assert.equal(f.state,0);assert.ok(f.reels.every(r=>r.state===0));assert.match(f.error,/timeout/)});
test('duplicate spin ignored and stop requested before reply is honored when board arrives',async()=>{
 const f=flow();let release,calls=0;f.api={spin:()=>{calls++;return new Promise(r=>release=r)}};
 const running=f.spin();await f.spin();assert.equal(calls,1);f.stop();assert.equal(f.click_stop,true);
 release({betId:'a',spinIndex:0,stepIndex:1,mode:'base',board:Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>({id:c*5+r+1,symbolId:2}))),wins:[],removedIds:[],transformedIds:[],balance:'100',betAmount:'200',winAmount:'0',totalWinAmount:'0',freeRemaining:0,nextAction:'complete'});
 for(let i=0;i<10;i++){await Promise.resolve();f.update(.1)}await running;
 assert.equal(f.state,0);assert.equal(f.balance,'100');assert.equal(f.click_stop,false);
});
test('state conflict synchronizes without issuing another bet automatically',async()=>{
 let posts=0,states=0;const api=new GameApi('',identity,async(route,body)=>{if(route.endsWith('/state')){states++;return {requestId:states===1?'stale':'fresh',balance:'99',hasNext:false}}posts++;if(posts===1)throw Object.assign(Error('conflict'),{status:409});return {nextRequestId:'next'}});
 await assert.rejects(api.spin('200'),e=>e.progress.balance==='99');assert.equal(posts,1);assert.equal(states,2);await api.spin('500');assert.equal(posts,2);
});
const {symbolPaths}=require(path.join(root,'effects/effect_library.ts'));
const {bigWinType,rollMoney}=require(path.join(root,'effects/game_effects.ts'));
const {Anticipation,anticipationColumns}=require(path.join(root,'effects/anticipation.ts'));
test('native effect symbol mapping resolves every normal and gold tile to the correct source frame',()=>{
 const prefab=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/resources/mahjong_effects/mahjongway/res/load/prefab/games/cell_win.prefab')));
 const frames=['90ccf','4c2b9','baf0a','fbf74','c8d8a','be1f4','3cfa3','63022'];
 for(let symbol=1;symbol<=8;symbol++){
  const node=prefab.find(n=>n.__type__==='cc.Node'&&n._name===symbolPaths[symbol].split('/')[1]);
  const sprite=node._components.map(r=>prefab[r.__id__]).find(c=>c.__type__==='cc.Sprite');
  assert.equal(sprite._spriteFrame.__uuid__.split('@')[1],frames[symbol-1]);
 }
 assert.equal(symbolPaths[9],'c10');assert.equal(symbolPaths[10],'c9');
});
test('source prefabs contain no old platform controllers or serialized callbacks',()=>{
 const folder=path.join(__dirname,'../assets/resources/mahjong_effects/mahjongway/res/load/prefab/games');
 for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.prefab'))){
  const data=JSON.parse(fs.readFileSync(path.join(folder,name)));
  for(const obj of data)if(obj.__type__&&!obj.__type__.startsWith('cc.'))assert.equal(obj.__type__,'fa1638wUmZDrIAAJvGGnFR2',name);
 }
});
test('native presentation count-up preserves integer money and 5/15/50 thresholds',()=>{
 assert.equal(rollMoney('9007199254740993000',.5),'4,503,599,627,370,496,500');assert.equal(bigWinType('499','100'),0);assert.equal(bigWinType('500','100'),1);assert.equal(bigWinType('1500','100'),2);assert.equal(bigWinType('5000','100'),3);
});
test('anticipation excludes preview/free/turbo and releases all waits on stop',()=>{
 const board=[11,11,2,2,2].map(s=>[{symbolId:11},{symbolId:s},{symbolId:2},{symbolId:2},{symbolId:2}]);
 assert.deepEqual(anticipationColumns(board,false,false),[false,false,true,true,true]);
 assert.ok(anticipationColumns(board,true,false).every(v=>!v));assert.ok(anticipationColumns(board,false,true).every(v=>!v));
 const reels=Array.from({length:5},()=>({state:2,delay_end_time:0})),events=[];
 const anti=new Anticipation(reels,(c,on)=>events.push([c,on]));anti.begin(anticipationColumns(board,false,false));anti.tick();assert.equal(reels[2].delay_end_time,.1);reels[1].state=0;anti.tick();assert.equal(reels[2].delay_end_time,4);assert.deepEqual(events,[[2,true]]);anti.clear();assert.equal(reels[2].delay_end_time,0);assert.equal(reels[4].delay_end_time,0);
});
test('native button art has no embedded click handlers competing with scene controls',()=>{
 for(const name of ['control_spin','control_stop','control_turbo']){
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/resources/mahjong_effects/'+name+'.prefab')));
  assert.ok(data.some(n=>n.__type__==='cc.Animation'),name);
  assert.ok(data.every(n=>n.__type__!=='cc.Button'),name);
 }
});
test('popup click completes count first and does not close twice on one bubbling event',()=>{
 const {GameEffects}=require(path.join(root,'effects/game_effects.ts'));const effect=new GameEffects();let counted=0,closed=0;
 effect.popupFinish=()=>{};effect.popupAge=1;effect.completeCount=()=>counted++;effect.popupExit=()=>closed++;
 assert.equal(effect.dismiss(),true);assert.equal(counted,1);assert.equal(effect.dismiss(),true);assert.equal(closed,0);
 effect.popupAge=1.1;effect.dismiss();assert.equal(closed,1);
});

test('cascade plays scatter landing once for falling active cells only', () => {
 const {r,cells}=makeReel(0);
 const calls=Array(7).fill(0);
 cells.forEach((cell,i)=>cell.component.playScatterStop=()=>calls[i]++);
 r.dropTo([9,9,9,9,9,9,9],[-2,-1,0,3,4]);
 for(let i=0;i<120;i++)r.tick(1/60);
 assert.deepEqual(calls,[0,0,1,1,0,0,0]);
});

test('manual stop plays landing effects once on moving reels only', () => {
 const f=flow();
 const calls=Array(5).fill(0);
 f.state=2;
 f.reels.forEach((r,i)=>{r.state=i===0?0:2;r.playLandingEffects=()=>calls[i]++;});
 f.stop();
 f.stop();
 assert.deepEqual(calls,[0,1,1,1,1]);
 assert.ok(f.reels.every(r=>r.state===0));
});

test('cascade does not replay old scatter even when it falls; new scatter plays once', () => {
 const {r,cells}=makeReel(0);
 const calls=Array(7).fill(0);
 cells.forEach((cell,i)=>cell.component.playScatterStop=()=>calls[i]++);
 r.dropTo([1,1,9,9,1,1,1],[-2,-1,0,3,4],[false,false,true,false,false]);
 for(let i=0;i<120;i++)r.tick(1/60);
 r.playDropLandingEffects();
 assert.deepEqual(calls,[0,0,0,1,0,0,0]);
});
test('manual stop during cascade keeps old scatter quiet and consumes new scatter once', () => {
 const {r,cells}=makeReel(0);
 const calls=Array(7).fill(0);
 cells.forEach((cell,i)=>cell.component.playScatterStop=()=>calls[i]++);
 r.dropTo([1,1,9,9,1,1,1],[-2,-1,0,3,4],[false,false,true,false,false]);
 r.stop();r.playDropLandingEffects();r.playDropLandingEffects();
 assert.deepEqual(calls,[0,0,0,1,0,0,0]);
});

test('blur starts independently after each reel finishes lifting', () => {
 const reels=Array.from({length:5},(_,i)=>{
  const {r,cells}=makeReel(i);
  const blurred=Array(7).fill(false);
  cells.forEach((cell,j)=>cell.component.setBlur=(value)=>blurred[j]=value);
  r.startRoll();
  return {r,blurred};
 });
 for(let i=0;i<10;i++)reels.forEach(({r})=>r.tick(1/60));
 assert.ok(reels[0].blurred.every(Boolean));
 for(const {blurred} of reels.slice(1))assert.ok(blurred.every(v=>!v));
 for(let i=0;i<90;i++)reels.forEach(({r})=>r.tick(1/60));
 reels.forEach(({blurred})=>assert.ok(blurred.every(Boolean)));
});


test('highlight end restores original cell layering while flip animation continues', () => {
 const f=flow();let restored=0;
 f.awardShade={node:{active:true}};
 f.awardEffects={active:true};
 f.reels.forEach(r=>r.restoreWinLayers=()=>restored++);
 f.endAwardHighlight();f.endAwardHighlight();
 assert.equal(restored,5);
 assert.equal(f.awardShade.node.active,false);
 assert.equal(f.awardEffects.active,true);
 const {slots_cell:Cell}=require(path.join(root,'slots/slots_cell.ts'));
 const cell=new Cell();cell.node={};cell.winning=true;
 const effect={parent:{},setParent(parent,keepWorld){this.parent=parent;assert.equal(keepWorld,false)}};
 cell.effect={node:effect};cell.restoreWinLayer();
 assert.equal(effect.parent,cell.node);
 assert.equal(cell.winning,true);
});

test('sprite selection preserves disabled static background during flip animation', () => {
 const {MWSpriteCtrl}=require(path.join(root,'effects/MWSpriteCtrl.ts'));
 const ctrl=new MWSpriteCtrl();
 const sprite={enabled:false,spriteFrame:null};
 ctrl.sprList=['white','gold'];ctrl.getComponent=()=>sprite;
 ctrl.setSpriteIndex(1);
 assert.equal(sprite.spriteFrame,'gold');
 assert.equal(sprite.enabled,false);
 sprite.enabled=true;ctrl.setSpriteIndex(0);
 assert.equal(sprite.enabled,true);
});

test('column awards start left to right with stagger and wait for delayed columns', async () => {
 const f=flow(),pending=[],started=[];
 f.pause=(seconds)=>new Promise(resolve=>pending.push({seconds,resolve}));
 f.reels.forEach((r,i)=>r.award=(rows)=>started.push([i,rows]));
 const frame={board:Array.from({length:5},(_,i)=>[{id:i+1}]),transformedIds:[]};
 let finished=false;
 const playing=f.playColumnAwards(frame,new Set([1,2,3,4,5])).then(()=>finished=true);
 assert.deepEqual(started,[[0,[0]]]);
 assert.deepEqual(pending.map(p=>p.seconds),[.02,.04,.06,.08]);
 assert.equal(finished,false);
 for(const p of pending){p.resolve();await Promise.resolve();}
 await playing;
 assert.deepEqual(started.map(v=>v[0]),[0,1,2,3,4]);
 assert.equal(finished,true);
});

test('drop stagger skips columns where all winning cells became wild', () => {
 const {cascadeDropDelays}=require(path.join(root,'slots/server_board.ts'));
 const idle=[0,1,2,3,4],fall=[-1,0,1,2,3];
 assert.deepEqual(cascadeDropDelays([fall,idle,fall,idle,idle],.06),[.06,0,0,0,0]);
 assert.deepEqual(cascadeDropDelays([fall,fall,fall,idle,idle],.06),[.12,.06,0,0,0]);
 assert.deepEqual(cascadeDropDelays([idle,idle,idle,idle,idle],.06),[0,0,0,0,0]);
});
test('delayed drop starts accelerating only after column delay', () => {
 const {r,cells}=makeReel(0);
 r.dropTo([1,1,2,3,4,5,1],[-1,0,1,2,3],undefined,.1);
 const y=cells[2].position.y;
 r.tick(.06);assert.equal(cells[2].position.y,y);
 r.tick(.06);const moved=y-cells[2].position.y;assert.ok(moved>0);
 r.tick(.05);assert.ok((y-cells[2].position.y)>moved*3.5);
 r.stop();r.tick(.2);assert.equal(r.state,0);
});


test('manual stop on base spin does not instantly stop following free spins', async () => {
 const f=flow(),observed=[],starts=Array(5).fill(0),stops=Array(5).fill(0);
 f.click_stop=true;
 f.reels.forEach((r,i)=>{
  r.startRoll=()=>{starts[i]++;r.state=1};
  r.stopRoll=()=>{observed.push(f.click_stop);r.state=2};
  r.stop=()=>{stops[i]++;r.state=0};
 });
 f.pause=async()=>{};
 f.until=async(predicate)=>{f.reels.forEach(r=>r.state=0);assert.ok(predicate())};
 const make=(spin,mode,next)=>({betId:'free-chain',spinIndex:spin,stepIndex:1,mode,
  board:Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>({id:c*5+r+1,symbolId:2}))),
  wins:[],removedIds:[],transformedIds:[],balance:'100',betAmount:'200',winAmount:'0',
  totalWinAmount:'0',freeRemaining:2-spin,nextAction:next});
 const next=[make(1,'free','next_free'),make(2,'free','complete')];
 f.api={spin:async()=>next.shift()};
 await f.play(make(0,'base','start_free'));
 assert.deepEqual(observed,[...Array(5).fill(true),...Array(10).fill(false)]);
 assert.deepEqual(starts,Array(5).fill(3));
 assert.deepEqual(stops,Array(5).fill(1));
});

test('reconnect restores settled board and WIN before requesting next round; a+b accumulates once', async () => {
 const f=flow(),trace=[];let spins=0,starts=0;
 const board=Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>({id:c*5+r+1,symbolId:2})));
 const frame=(step,total,win,next)=>({betId:'restore-bet',spinIndex:0,stepIndex:step,mode:'base',board,
  wins:win==='0'?[]:[{cellIds:[1]}],removedIds:[],transformedIds:[],balance:step===1?'499910':'499930',
  betAmount:'100',winAmount:win,totalWinAmount:total,freeRemaining:0,nextAction:next,nextRequestId:'next-'+step});
 f.reels.forEach((r,i)=>{
  r.showBoard=()=>{trace.push(['snapshot',i]);r.state=0};
  r.startRoll=()=>{starts++;r.state=1};
  r.dropTo=()=>{r.state=0};
  r.award=()=>trace.push(['award',i,f.winAmount]);
 });
 f.showAwardShade=()=>{};f.hideAwardShade=()=>{};
 f.pause=async()=>{};f.until=async(predicate)=>assert.ok(predicate());
 f.api={login:async()=>({balance:'499910'}),config:async()=>({betOptions:['100'],defaultBet:'100'}),
  state:async()=>({hasNext:true,balance:'499910',lastFrame:frame(1,'10','10','continue')}),
  spin:async()=>{trace.push(['request',f.winAmount]);return ++spins===1?frame(2,'30','20','continue'):frame(3,'30','0','complete')}};
 await f.connect();
 assert.equal(starts,0);
 assert.equal(spins,2);
 assert.equal(f.balance,'499930');assert.equal(f.winAmount,'30');
 assert.deepEqual(trace.filter(t=>t[0]==='request'),[['request','10'],['request','30']]);
 assert.ok(trace.findIndex(t=>t[0]==='snapshot')<trace.findIndex(t=>t[0]==='award'));
 assert.ok(trace.findIndex(t=>t[0]==='award')<trace.findIndex(t=>t[0]==='request'));
});
test('reconnect of a completed bet restores static board and total without spinning or paying again', async () => {
 const f=flow();let shown=0;
 f.reels.forEach(r=>r.showBoard=()=>{shown++;r.state=0});
 f.pause=async()=>{};
 f.api={login:async()=>({balance:'500030'}),config:async()=>({betOptions:['100'],defaultBet:'100'}),
  state:async()=>({hasNext:false,balance:'500030',lastFrame:{betId:'done',spinIndex:0,stepIndex:3,mode:'free',
   board:Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>({id:c*5+r+1,symbolId:2}))),
   wins:[],removedIds:[],transformedIds:[],balance:'old-snapshot',betAmount:'100',winAmount:'0',
   totalWinAmount:'130',freeRemaining:0,nextAction:'complete',spinWinAmount:'99999'}}),
  spin:async()=>assert.fail('completed recovery must not send a bet')};
 f.effects={multiplier(){},freeEnd:async()=>assert.fail('must not replay free summary'),bigWin:async()=>assert.fail('must not replay big win')};
 await f.connect();
 assert.equal(shown,5);assert.equal(f.balance,'500030');assert.equal(f.winAmount,'130');assert.equal(f.state,0);
});


test('Stop is ignored during cascade delay, movement and rebound without retaining stop intent', () => {
 const f=flow();const {r,cells}=makeReel(0);
 f.reels=[r];f.state=2;
 r.dropTo([1,1,2,3,4,5,1],[-1,0,1,2,3],undefined,.06);
 const initial=cells.map(c=>c.position.y);
 f.stop();assert.equal(f.click_stop,false);assert.equal(r.state,5);
 assert.equal(r.canManualStop,false);
 assert.deepEqual(cells.map(c=>c.position.y),initial);
 r.tick(.08);
 const midway=cells.map(c=>c.position.y);
 assert.notDeepEqual(midway,initial);
 f.stop();assert.equal(r.state,5);assert.equal(f.click_stop,false);
 assert.deepEqual(cells.map(c=>c.position.y),midway);
 let rebound=false;
 for(let i=0;i<120&&r.state===5;i++){
  if(r.drops.every(d=>d===0))rebound=true;
  f.stop();assert.equal(f.click_stop,false);
  r.tick(1/60);
 }
 assert.equal(rebound,true);assert.equal(r.state,0);
});

test('Stop waits until last reel rolls 100ms then stops every reel together', () => {
 for(const fast of [false,true]) {
  const f=flow();f.fast=fast;f.state=2;
  f.reels=Array.from({length:5},(_,i)=>makeReel(i).r);
  f.reels.forEach(r=>{r.startRoll();r.stopRoll([1,2,3,4,5,6,7])});
  f.stop();assert.ok(f.reels.every(r=>r.state!==0));
  for(let i=0;i<180&&f.reels[4].state===1;i++){
   f.update(1/60);assert.ok(f.reels.every(r=>r.state!==0));
  }
  for(let i=0;i<5;i++){
   f.update(1/60);assert.ok(f.reels.every(r=>r.state!==0));
  }
  f.update(1/60);assert.ok(f.reels.every(r=>r.state===0));
 }
});
test('Stop is immediate for all reels once last reel already meets the minimum', () => {
 const f=flow();f.state=2;f.reels=Array.from({length:5},(_,i)=>makeReel(i).r);
 f.reels.forEach(r=>{r.startRoll();r.stopRoll([1,2,3,4,5,6,7])});
 for(let i=0;i<60;i++)f.update(1/60);
 assert.equal(f.reels[4].canManualStop,true);
 f.stop();assert.ok(f.reels.every(r=>r.state===0));
});

test('cascade gains speed and follows the same trajectory at 30, 60 and 120 FPS', () => {
 const positions=[];
 for(const fps of [30,60,120]){
  const {r,cells}=makeReel(0);
  r.dropTo([1,1,2,3,4,5,1],[-2,-1,0,3,4]);
  const initial=cells.map(c=>c.position.y);
  for(let i=0;i<fps/10;i++)r.tick(1/fps);
  positions.push(initial[2]-cells[2].position.y);
  assert.ok(r.dropVelocity>600);
  for(const i of [1,2,3])assert.ok(Math.abs(initial[i]-cells[i].position.y-positions.at(-1))<1e-8);
 }
 assert.ok(positions.every(d=>Math.abs(d-positions[0])<1e-8));
 const {r,cells}=makeReel(0);
 r.dropTo([1,1,2,3,4,5,1],[-2,-1,0,3,4]);
 const y=cells[2].position.y;
 r.tick(.05);const first=y-cells[2].position.y;
 const middle=cells[2].position.y;
 r.tick(.05);assert.ok(middle-cells[2].position.y>first);
 for(let i=0;i<120;i++)r.tick(1/60);
 assert.equal(r.state,0);
 assert.deepEqual(cells.map(c=>c.position.y),[165,0,-165,-330,-495,-660,-825]);
});

test('round transitions pause 200ms before award and after elimination before next request', async () => {
 const f=flow(),trace=[];
 const board=Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>({id:c*5+r+1,symbolId:2})));
 const frame={betId:'pause-chain',spinIndex:0,stepIndex:1,mode:'base',board,wins:[{cellIds:[1]}],
  removedIds:[],transformedIds:[],balance:'499910',betAmount:'100',winAmount:'10',totalWinAmount:'10',freeRemaining:0,nextAction:'continue'};
 f.reels.forEach(r=>{r.showBoard=()=>r.state=0;r.dropTo=()=>{trace.push('drop');r.state=0}});
 f.pause=async seconds=>trace.push(seconds);
 f.until=async predicate=>assert.ok(predicate());
 f.showAwardShade=()=>trace.push('shade');f.hideAwardShade=()=>{};
 f.playColumnAwards=async()=>trace.push('award');
 f.api={spin:async()=>{trace.push('request');return {...frame,stepIndex:2,wins:[],winAmount:'0',nextAction:'complete'}}};
 await f.play(frame,true);
 assert.deepEqual(trace.slice(0,5),[.2,'shade','award',.2,'request']);
 assert.ok(trace.indexOf('drop')>trace.indexOf('request'));
});

const {initialStrips} = require(path.join(root,'slots/initial_board.ts'));
test('initial connection does not initialize cells until state responds; no history uses fixed board', async () => {
 const f=flow(); let release; const calls=[];
 f.ready=false; f.initializeCells=strips=>calls.push(strips);
 f.api={login:async()=>({balance:'500000'}),config:async()=>({betOptions:['200'],defaultBet:'200'}),state:()=>new Promise(resolve=>release=resolve)};
 const pending=f.connect();
 await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
 assert.equal(calls.length,0); assert.equal(f.ready,false);
 release({balance:'500000',hasNext:false}); await pending;
 assert.deepEqual(calls,[initialStrips()]); assert.equal(f.ready,true);
 const a=initialStrips(); a[0][2]=99; assert.equal(initialStrips()[0][2],6);
});

test('big-win popup starts Big, upgrades at thresholds and preserves accumulated display', () => {
 const visuals=require(path.join(root,'effects/big_win_visuals.ts'));
 const saved=visuals.applyBigWinTier,tiers=[];
 const {GameEffects}=require(path.join(root,'effects/game_effects.ts'));
 const effect=new GameEffects(),label={string:''};
 const native={node:{getChildByPath:()=>({getComponent:()=>label})}};
 visuals.applyBigWinTier=(_effect,tier)=>tiers.push(tier);
 effect.popup=(_name,setup)=>setup(native);
 effect.playMusic=()=>{};
 try {
  effect.bigWin('8000',3,'100');
  assert.deepEqual(tiers,[1]);assert.equal(label.string,'0');
  effect.popupTick(8/3);assert.deepEqual(tiers,[1,2]);assert.equal(label.string,'1,500');
  effect.popupTick(16/3);assert.deepEqual(tiers,[1,2,3]);assert.equal(label.string,'5,000');
  effect.completeCount();assert.equal(label.string,'8,000');
 } finally {visuals.applyBigWinTier=saved;}
});
