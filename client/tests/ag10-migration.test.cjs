const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../../slots_lobby/node_modules/typescript');
const root=path.resolve(__dirname,'../fortunechinchilla');
const source=path.join(root,'assets/fortunechinchilla-code');
function load(file,globals={}) {
 const cache=new Map();
 function read(p){p=path.resolve(p);if(!path.extname(p))p+='.ts';if(cache.has(p))return cache.get(p).exports;const module={exports:{}};cache.set(p,module);
 const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const box={module,exports:module.exports,console,URL,URLSearchParams,AbortSignal,setTimeout,...globals,require:id=>read(path.resolve(path.dirname(p),id))};vm.runInNewContext(code,box,{filename:p});return module.exports;}
 return read(path.join(source,file));
}
const adapter=()=>load('game/net/FCResultAdapter.ts');
function frame(){return {board:adapter().defaultBoard,wins:[],betId:'qa',stepIndex:1,balance:10000,mode:'base',nextAction:'complete',triggeredFree:false,winAmount:0,totalWinAmount:0,betAmount:100,freeRemaining:0,gameData:{ruleType:'fortune_rabbit_v1',specialIndex:0,specialTotal:0,specialRemaining:0,lineWins:[],replay:{payouts:[]}}};}
test('AG10 maps 3/4/3 server cells to original bottom-to-top slots including middle upper cell',()=>{
 const a=adapter(),b=a.defaultBoard;const result=a.boardToIcons(b);assert.deepEqual(Array.from(result.indices.values()),[7,4,1,11,8,5,2,9,6,3]);assert.equal(result.icons[9],10);assert.equal(result.icons[11],10);
 const prize=b.map(col=>col.map(cell=>({...cell,symbolId:20})));assert.equal(a.boardToIcons(prize).icons[0],20);
 assert.throws(()=>a.boardToIcons(b.map((col,i)=>i===1?col.slice(1):col)),/column/);
});
test('AG10 paid amounts and line cells are validated without inventing awards',()=>{
 const a=adapter(),f=frame();f.wins=[{symbolId:1,cellIds:[1,5,8],columns:3,ways:1,rawPayout:'2'}];f.winAmount=f.totalWinAmount=200;
 f.gameData.lineWins=[{line:1,symbolId:1,cellIds:[1,5,8],payout:2}];f.gameData.replay.payouts=[{symbolId:1,columns:3,ways:1,rawPayout:'2',amount:'200'}];
 const result=a.toOriginalSpin(f);assert.deepEqual(Array.from(result.rotate.mAwardList[0].mIconIdxs),[7,8,9]);assert.equal(result.rotate.mAwardList[0].mMoney.toNumber(),200);
 f.winAmount=201;assert.throws(()=>a.toOriginalSpin(f),/win amount/);
});
test('AG10 per-prize animation uses actual settled amounts, including capped payouts',()=>{
 const a=adapter(),f=frame();Object.assign(f,{stepIndex:2,mode:'free',winAmount:123,totalWinAmount:123});Object.assign(f.gameData,{specialIndex:1,specialTotal:8});
 f.board=f.board.map(col=>col.map(c=>({...c,symbolId:20})));f.wins=[{symbolId:20,cellIds:[1],columns:1,ways:1,rawPayout:'500'}];f.gameData.replay.payouts=[{symbolId:20,columns:1,ways:1,rawPayout:'500',amount:'123'}];
 const r=a.toOriginalSpin(f);assert.equal(r.rewardAmounts.get(7),123);assert.equal(r.rotate.mAwardList[0].flag_id,11);
});
test('AG10 ships one main scene and no legacy platform transports or custom asset bundles',()=>{
 function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]);}
 const all=files(path.join(root,'assets'));assert.equal(all.filter(f=>f.endsWith('.scene')).length,1);
 for(const f of all){if(f.endsWith('.meta')&&path.basename(f)!=='resources.meta')assert.notEqual(JSON.parse(fs.readFileSync(f)).userData?.isBundle,true,f);
 if(f.endsWith('.ts'))assert.doesNotMatch(fs.readFileSync(f,'utf8'),/new WebSocket|assetManager\.loadBundle|GameBridge/);}
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'buildConfig_web-mobile.json')));assert.equal(cfg.scenes.length,1);assert.equal(cfg.scenes[0].url,'db://assets/FCGameScene.scene');
});
test('AG10 startup uses its own artwork in preview and web templates',()=>{
 const cover=fs.readFileSync(path.join(root,'assets/resources/res/image/loading/1022.jpg'));
 for(const template of ['preview-template','build-templates/web-mobile'])assert.deepEqual(fs.readFileSync(path.join(root,template,'loading/fortunechinchilla-cover.jpg')),cover);
});
test('AG10 waits for the current response before allowing every special spin to stop',()=>{
 const code=fs.readFileSync(path.join(source,'game/view/layer/FCCenterRollCtrl.ts'),'utf8');
 const tree=ts.createSourceFile('center.ts',code,ts.ScriptTarget.Latest,true);const cls=tree.statements.find(ts.isClassDeclaration);
 const method=name=>cls.members.find(m=>m.name?.getText(tree)===name).getText(tree);
 assert.match(method('resData'),/this\._canStop = false/);assert.match(method('acceptFrame'),/this\._canStop = true/);
 assert.doesNotMatch(method('triFreeGameAnim').split('} else {')[1],/this\._canStop = true/);
 assert.match(method('triFreeGameAnim'),/longmaojitaiedeng/);assert.match(method('playAvatarAnim'),/this\._avatarJzSp/);
});
test('AG10 network retry reuses the original request and does not prefetch special rounds',async()=>{
 const requests=[];let failed=false;let response=frame();response.requestId='one';response.nextRequestId='two';response.triggeredFree=true;response.nextAction='continue';response.freeRemaining=8;Object.assign(response.gameData,{specialRemaining:8,specialTotal:8});
 const globals={location:{href:'http://127.0.0.1:5192/',search:'',hostname:'127.0.0.1'},setTimeout:fn=>{fn();return 0},fetch:async(url,options)=>{
  requests.push(JSON.parse(options.body));if(!failed){failed=true;throw new Error('connection reset')}
  return {ok:true,status:200,json:async()=>({code:'OK',data:response})};
 }};
 const {FCGoSession}=load('game/net/FCGoSession.ts',globals),session=new FCGoSession();session.policy={lineCount:10};session.next='one';
 const first=await session.spin({bet:'10',betLevel:1});assert.equal(first.nextAction,'continue');assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(session.next,'two');
 response={...frame(),mode:'free',stepIndex:2,requestId:'two',nextRequestId:'three'};Object.assign(response.gameData,{specialIndex:1,specialTotal:8});
 await session.spin();assert.equal(requests.length,3);assert.deepEqual(requests[2],{bet:'10',betLevel:1,requestId:'two'});
 session.entry={replay:{}};await assert.rejects(session.spin({bet:'10',betLevel:1}),/Spin unavailable/);assert.equal(requests.length,3);
});
test('AG10 bounce keeps buffer active until every completion callback has fired on Creator 3.8.5',()=>{
 const text=fs.readFileSync(path.join(source,'game/view/layer/FCCellLayer.ts'),'utf8'),tree=ts.createSourceFile('cell.ts',text,ts.ScriptTarget.Latest,true),cls=tree.statements.find(ts.isClassDeclaration);const method=cls.members.find(m=>m.name?.getText(tree)==='backRoll').getText(tree);
 const callbacks=[];const chain=()=>({by(){return this},clone(){return this},call(fn){callbacks.push(fn);return this},start(){return this}});
 const box={exports:{},tween:chain,Vec3:class{},fcframe:{log:{logView(){}}},FCGameManager:{getStop:()=>false,getFastAndNoFree:()=>false},FCAudioMgr:{Instance:{playSound(){}}},FCConstant:{COL_COUNT:3}};
 vm.runInNewContext('exports.backRoll = ({'+method+'}).backRoll;',box);
 const nodes=[{active:true,position:{y:-89}},{active:true,position:{y:89}}];let stops=0;
 box.exports.backRoll.call({index:0,node:{children:nodes},slotsCtrl:{playBackRoll(){}},stopRoll(){stops++}});
 assert.ok(nodes.every(n=>n.active));callbacks[0]();assert.equal(stops,0);callbacks[1]();assert.equal(stops,1);assert.equal(nodes[0].active,false);assert.equal(nodes[1].active,true);
});
test('AG10 actual saved special game preserves all 9 frames and exact final winnings',()=>{
 const saved=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/special-replay.json'))),a=adapter();
 assert.equal(saved.frames.length,9);assert.equal(saved.frames[0].triggeredFree,true);assert.equal(saved.frames[0].mode,'base');assert.ok(saved.startBoard.length);
 let total=0;for(const [i,f]of saved.frames.entries()){const mapped=a.toOriginalSpin(f);assert.equal(f.stepIndex,i+1);assert.equal(f.mode,i?'free':'base');total+=f.winAmount;assert.equal(f.totalWinAmount,total);assert.equal(f.nextAction,i===8?'complete':'continue');if(i)assert.equal(f.gameData.specialIndex,i);assert.equal(mapped.rotate.mIcons.length,12);}
 assert.equal(total,Number(saved.bet.totalWinAmount));assert.equal(total,460000);
});
