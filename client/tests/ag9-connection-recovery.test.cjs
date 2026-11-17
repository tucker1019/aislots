const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('../../slots_lobby/node_modules/typescript');
const root=path.join(__dirname,'../fortuneleopard/assets/fortuneleopard/src/game/view/layer');
function method(file,name,args,bindings){
 const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
 let body;
 function visit(node){if(ts.isMethodDeclaration(node)&&node.name.getText(source)===name)body=node.body.getText(source).slice(1,-1);ts.forEachChild(node,visit);}visit(source);
 assert.ok(body, name);
 return new Function(...Object.keys(bindings),ts.transpileModule(`return function(${args}){${body}}`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText)(...Object.values(bindings));
}
test('AG9 connection recovery supplies three visible cells plus the top buffer without undefined symbols',()=>{
 const types=[];
 const bindings={FLConstant:{ROW_COUNT:3,CELL_SIZE:{height:203}},FLGameManager:{getRandomType:()=>4},Tween:{stopAllByTarget(){}},Vec3:class{},FLCellItem:class{},console:{log(){}}};
 const resume=method('FLCellLayer.ts','resumeSpecial','',bindings);
 const setResult=method('FLCellLayer.ts','setResultData','data',bindings);
 const reel={index:0,bottomY:0,resultData:[],resultCell:[],allCellList:Array.from({length:5},()=>({setPosition(){},getComponent:()=>({setTypeView:type=>types.push(type)})})),getTempResultData(){return this.resultData.slice();},setResultData:setResult,resumeSpecial:resume};
 const recover=method('FLCenterRollCtrl.ts','stopForConnectionError','',{});
 recover.call({cellLayerCtrlList:[reel]});
 assert.equal(types.length,5);
 assert.ok(types.every(Number.isInteger));
 assert.deepEqual(types.slice(1,4),[0,0,0]);
 assert.equal(reel._startMove,false);
});
test('AG9 win frame resolves the actual child Spine from the serialized prefab hierarchy',()=>{
 const prefab=JSON.parse(fs.readFileSync(path.join(root,'../../../../../resources/res/load/prefab/games/win_kuang.prefab'),'utf8'));
 const calls=[];const Skeleton=class{};
 function nodeAt(index){
  const row=prefab[index];
  return {active:false,getChildByName(name){const ref=(row._children||[]).find(ref=>prefab[ref.__id__]._name===name);return ref?nodeAt(ref.__id__):null;},getComponent(type){
   assert.equal(type,Skeleton);
   const ref=(row._components||[]).find(ref=>prefab[ref.__id__].__type__==='sp.Skeleton');
   if(!ref)return null;
   const data=prefab[ref.__id__];assert.equal(data.defaultAnimation,'animation');
   return {setAnimation(...args){calls.push(['set',...args]);},addAnimation(...args){calls.push(['add',...args]);}};
  }};
 }
 const kuang=nodeAt(prefab.find(row=>row.__type__==='cc.Prefab').data.__id__);
 assert.equal(kuang.getComponent(Skeleton),null);
 const play=method('FLCenterRollCtrl.ts','playKuang','idx',{xNodeFL:{find:()=>kuang},sp:{Skeleton}});
 play.call({node:{getChildByName:()=>({})}},0);
 assert.deepEqual(calls,[['set',0,'animation',false],['add',0,'animation',false]]);
});
test('AG9 technical failures retain the original error in console without showing an alert',()=>{
 const calls=[];const error=new TypeError('test failure');
 const fail=method('FLGameLayerCtrl.ts','goFailure','error',{console:{error(...args){calls.push(args);}}});
 const ctrl={optCtrl:{canSendSpin:true},centerRollCtrl:{stopForConnectionError(){}}};
 fail.call(ctrl,error);
 assert.equal(calls.length,1);assert.equal(calls[0][1],error);
 assert.equal(ctrl.optCtrl.canSendSpin,false);
});
test('AG9 big-win effects reference Spine nodes that exist in the real leopard prefab',()=>{
 const prefab=JSON.parse(fs.readFileSync(path.join(root,'../../../../../resources/res/load/prefab/games/big_win_2.prefab'),'utf8'));
 const source=fs.readFileSync(path.join(root,'FLBigWinCtrl.ts'),'utf8');
 const names=Array.from(source.matchAll(/findComponent\("([^"]+)", panel, sp\.Skeleton\)/g),match=>match[1]);
 assert.ok(names.length>5);
 for(const name of names){
  const node=prefab.find(row=>row.__type__==='cc.Node'&&row._name===name);
  assert.ok(node, name);
  assert.ok(node._components.some(ref=>prefab[ref.__id__].__type__==='sp.Skeleton'),name+' Spine');
 }
});
test('AG9 stop click uses the leopard button Spine, never missing tiger arrow nodes',()=>{
 let stopped=false;const animations=[];
 const bindings={FLGameManager:{getStop:()=>stopped,setStop:value=>{stopped=value;}},FLAudioMgr:{Instance:{playSound(){}}},Tween:{stopAllByTarget(){}},xNodeFL:{find(){assert.fail('old tiger node lookup');}}};
 const play=method('FLOptCtrl.ts','playSpinSpAnim','type',bindings);
 const stop=method('FLOptCtrl.ts','onStopRollClick','',bindings);
 const ctrl={sp_spin:{node:{active:false},setAnimation(...args){animations.push(args);}},playSpinSpAnim:play};
 stop.call(ctrl);stop.call(ctrl);
 assert.deepEqual(animations,[[0,'idle3',true]]);
 assert.equal(ctrl.sp_spin.node.active,true);
 const scene=JSON.parse(fs.readFileSync(path.join(root,'../../../../../../assets/FLGameScene.scene'),'utf8'));
 const node=scene.find(row=>row.__type__==='cc.Node'&&row._name==='buttonSp');
 assert.ok(node._components.some(ref=>scene[ref.__id__].__type__==='sp.Skeleton'));
});
test('AG9 restored reel effects resolve against the leopard scene, including their component types',()=>{
 const scene=JSON.parse(fs.readFileSync(path.join(root,'../../../../../../assets/FLGameScene.scene'),'utf8'));
 const nodes=new Map();
 function walk(index,prefix){const row=scene[index],key=prefix+'/'+row._name;nodes.set(key,row);for(const child of row._children||[])walk(child.__id__,key);}
 walk(scene.findIndex(row=>row.__type__==='cc.Node'&&row._name==='Canvas'),'');
 for(const [relative,type]of [
  ['layout_center/sb_vfx_e_add','sp.Skeleton'],
  ['layout_center/ui_02e','cc.UIOpacity'],['layout_center/ui_03e','cc.UIOpacity'],
  ['layout_center/hongbao/rs_start_hongbao','sp.Skeleton'],
  ['layout_bottom/panel1/buttonSp','sp.Skeleton'],
 ]){
  const node=nodes.get('/Canvas/GameLayer/'+relative);assert.ok(node,relative);
  assert.ok(node._components.some(ref=>scene[ref.__id__].__type__===type),relative+' '+type);
 }
 for(const relative of ['layout_center/respin_bg','layout_center/bg/num_red_1_0','layout_center/bg/num_yellow_5_1'])assert.ok(nodes.has('/Canvas/GameLayer/'+relative),relative);
 const sprite=scene.find(row=>row.__type__==='435f1U22F1JaJ0aOUIMGgy4');
 assert.equal(sprite.EnSprList.length,4);
 assert.equal(sprite.PtSprList.length,4);
 const source=fs.readFileSync(path.join(root,'FLCenterRollCtrl.ts'),'utf8');
 assert.match(source,/getPrefab\("res\/load\/prefab\/games\/big_win_2"\)/);
 assert.doesNotMatch(source,/start_spin_guang_kuang|bg\/win|hongbao_open/);
});
test('AG9 bet dialog is bound to the amount button, separately from Spin',()=>{
 const source=fs.readFileSync(path.join(root,'FLOptCtrl.ts'),'utf8');
 const betPath=source.match(/this\.btn_bet\s*=\s*xNodeFL\.find\("([^"]+)"/)[1];
 const spinPath=source.match(/this\.btn_go\s*=\s*xNodeFL\.find\("([^"]+)"/)[1];
 assert.equal(betPath,'fenzhikuang/node_bet');
 assert.notEqual(betPath,spinPath);
 const scene=JSON.parse(fs.readFileSync(path.join(root,'../../../../../../assets/FLGameScene.scene'),'utf8'));
 const bet=scene.find(row=>row.__type__==='cc.Node'&&row._name==='node_bet');
 assert.ok(bet._components.some(ref=>scene[ref.__id__].__type__==='cc.Button'));
});
test('AG9 replay shows the recorded bet while keeping the wallet private',()=>{
 const bindings={Tween:{stopAllByTarget(){}},goSession:{entry:{replay:{betAmount:1234500}}},showMoney:value=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(value/100)};
 const update=method('FLOptCtrl.ts','setAllNum','nums',bindings);
 const ctrl={layerCtrl:{isReplay:true},lab_all_money:{node:{},string:''},lab_bit_bottom:{string:'000'}};
 update.call(ctrl);
 assert.equal(ctrl.lab_bit_bottom.string,'12.345');
 assert.equal(ctrl.lab_all_money.string,'******');
});
test('AG9 avatar random idle only selects animations present in the original leopard skeleton',()=>{
 for(const random of [0,0.34,0.67,0.99]){
  const calls=[];let callback;
  const chain={repeatForever(){return this;},delay(){return this;},call(fn){callback=fn;return this;},start(){return this;}};
  const play=method('FLCenterRollCtrl.ts','playAvatarIdleAnim','',{Tween:{stopAllByTarget(){}},tween:()=>chain,Math:{random:()=>random,floor:Math.floor},FLAudioMgr:{Instance:{playSound(){}}}});
  play.call({_avatarSp:{setAnimation(_track,name){calls.push(name);},addAnimation(_track,name){calls.push(name);}}});
  callback();
  assert.ok(['idle2','idle4','idle5'].includes(calls[1]),calls[1]);
  assert.equal(calls[2],'idle');
 }
});
test('AG9 winning banner activates its parent before playing the child Spine',()=>{
 const source=fs.readFileSync(path.join(root,'FLOptCtrl.ts'),'utf8');
 const ast=ts.createSourceFile('opt.ts',source,ts.ScriptTarget.Latest,true);let body;
 function visit(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)==='setBigAwardNum')body=n.body.getText(ast).slice(1,-1);ts.forEachChild(n,visit);}visit(ast);
 const bg={active:false};const node={active:true,children:[bg]};const chain={to(){return this;},delay(){return this;},start(){return this;}};
 const bindings={FLGameManager:{getTotalBitNum:()=>100,getWinType:()=>1},FLAudioMgr:{Instance:{playSound(){}}},xNodeFL:{find:(name)=>name==='ib_bar_a'?bg:{active:false},findComponent:(name,_parent,type)=>type==='Skeleton'?{node:{active:false},setAnimation(){assert.equal(bg.active,true,'parent must be active before Spine initialization');}}:type==='Animation'?{node:{active:false},play(){}}:{node:{active:false},opacity:0},setLabel(){}},sp:{Skeleton:'Skeleton'},Animation:'Animation',UIOpacity:'UIOpacity',tween:()=>chain,Vec3:class{},showMoney:String};
 new Function(...Object.keys(bindings),ts.transpileModule(`return function(award,winType){${body}}`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText)(...Object.values(bindings)).call({node_win_big:node},100,1);
});
test('AG9 avatar completion returns to idle next tick and cannot overwrite a newer action',()=>{
 const callbacks=[],scheduled=[],played=[];const ctrl={avatarAnimationVersion:0,_avatarSp:{setAnimation(_track,name){played.push(name);return{};},addAnimation(){},setTrackCompleteListener(_entry,callback){assert.equal(typeof callback,'function');callbacks.push(callback);}},scheduleOnce(fn){scheduled.push(fn);},playAvatarIdleAnim(){this.avatarAnimationVersion++;played.push('idle');}};
 const play=method('FLCenterRollCtrl.ts','playAvatarAnim','type',{Tween:{stopAllByTarget(){}},FLAudioMgr:{Instance:{stopLongEffect(){},playLongEffect(){},playSound(){}}},Math});
 play.call(ctrl,'winSmall');callbacks[0]();assert.deepEqual(played,['win']);scheduled[0]();assert.deepEqual(played,['win','idle']);
 play.call(ctrl,'winSmall');callbacks[1]();play.call(ctrl,'winBig');scheduled[1]();assert.equal(played.at(-1),'win2');
});
test('AG9 opening waits until restored board has actually been drawn by Cocos',()=>{
 const events=[];let afterDraw;
 const restore=method('FLGameLayerCtrl.ts','restoreGoEntry','',{goSession:{entry:{live:{state:{}}}},director:{once(event,callback){assert.deepEqual(events,['board']);assert.equal(event,'after-draw');afterDraw=callback;}},Director:{EVENT_AFTER_DRAW:'after-draw'},window:{dispatchEvent(event){events.push(event.type);}},Event:class{constructor(type){this.type=type;}}});
 restore.call({isValid:true,centerRollCtrl:{setIdleBoard(){events.push('board');}},goFailure(error){throw error;}});
 assert.deepEqual(events,['board']);afterDraw();assert.deepEqual(events,['board','aislots-scene-rendered']);
 const bootstrap=fs.readFileSync(path.join(root,'../scenes/FLGame.ts'),'utf8');
 assert.doesNotMatch(bootstrap,/requestAnimationFrame\([^\n]*aislots-scene-rendered/);
});

test('AG9 one-shot avatar actions queue idle even if the next spin clears every scheduled callback',()=>{
 for(const type of ['winSmall','winBig','wildCollect','zw','triSpecialFailBack']){
  const queue=[];const scheduled=[];
  const ctrl={avatarAnimationVersion:0,_avatarSp:{setAnimation(track,name,loop){queue.length=0;queue.push({name,loop});return{};},addAnimation(track,name,loop){queue.push({name,loop});},setTrackCompleteListener(){}},scheduleOnce(fn){scheduled.push(fn);},playAvatarIdleAnim(){throw new Error('idle must not depend on scheduler');}};
  const play=method('FLCenterRollCtrl.ts','playAvatarAnim','type',{Tween:{stopAllByTarget(){}},FLAudioMgr:{Instance:{stopLongEffect(){},playLongEffect(){},playSound(){}}},Math});
  play.call(ctrl,type);scheduled.length=0;
  assert.equal(queue.length,2,type);assert.deepEqual(queue[1],{name:'idle',loop:true},type);
 }
});
