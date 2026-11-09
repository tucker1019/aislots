const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {WebAudioMixer}=require('../assets/mahjongway/src/audio/web_audio.ts');
const {GameAudio}=require('../assets/mahjongway/src/audio/game_audio.ts');
global.document={addEventListener(){},removeEventListener(){},hidden:false};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function context(){
 const ctx={currentTime:10,state:'running',destination:{},started:[],closed:false,
 createGain:()=>({gain:{value:1,setTargetAtTime(v){this.value=v;}},connect(){}}),
 decodeAudioData:async data=>({id:new Uint8Array(data)[0]}),
 createBufferSource:()=>({connect(){},disconnect(){},start(when){this.when=when;ctx.started.push(this);},stop(){this.stopped=true;}}),
 resume:async()=>{ctx.state='running';},suspend:async()=>{ctx.state='suspended';},close:async()=>{ctx.closed=true;}};return ctx;
}
test('a cancelled loading track cannot start after the replacement track',async()=>{
 const ctx=context(),requests={};
 const mixer=new WebAudioMixer('/audio/',()=>ctx,url=>new Promise(resolve=>requests[url]=resolve));
 mixer.play('old','music',{slot:'bgm',loop:true});mixer.play('new','music',{slot:'bgm',loop:true});
 requests['/audio/new.mp3']({ok:true,arrayBuffer:async()=>new Uint8Array([2]).buffer});await flush();
 requests['/audio/old.mp3']({ok:true,arrayBuffer:async()=>new Uint8Array([1]).buffer});await flush();
 assert.equal(ctx.started.length,1);assert.equal(ctx.started[0].buffer.id,2);assert.equal(ctx.started[0].loop,true);
 mixer.destroy();assert.equal(ctx.started[0].stopped,true);assert.equal(ctx.closed,true);
});
test('decoded audio is reused while each playback gets a fresh source; delayed voices can be cancelled',async()=>{
 const ctx=context();let fetched=0;
 const mixer=new WebAudioMixer('/audio/',()=>ctx,async()=>{fetched++;return {ok:true,arrayBuffer:async()=>new Uint8Array([1]).buffer};});
 mixer.play('voice','voice',{slot:'first'});mixer.play('voice','voice',{slot:'next',delay:0.6});await flush();
 assert.equal(fetched,1);assert.equal(ctx.started.length,2);assert.equal(ctx.started[1].when,10.6);
 mixer.stop('next');assert.equal(ctx.started[1].stopped,true);
 mixer.play('voice');await flush();assert.equal(fetched,1);assert.equal(ctx.started.length,3);mixer.destroy();
});
test('destroy prevents a still loading one-shot from playing',async()=>{
 const ctx=context();let resolve;
 const mixer=new WebAudioMixer('/audio/',()=>ctx,()=>new Promise(r=>resolve=r));
 mixer.play('late');mixer.destroy();resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await flush();
 assert.equal(ctx.started.length,0);
});
function game(){
 const calls=[];const mixer={play(...args){calls.push(args);},stop(){},setVolume(){},destroy(){},attach(){},setMuted(){},preload(names){calls.push([names,'preload']);}};
 return {audio:new GameAudio(mixer),calls};
}
test('background music starts only after the start event',()=>{
 const {audio,calls}=game();
 audio.initialize();
 assert.equal(calls.filter(c=>c[1]==='music').length,0);
 audio.start?.();
 assert.equal(calls.filter(c=>c[1]==='music').map(c=>c[0]),['bgm_mg']);
});
test('stop sound is emitted once for all reel stop callbacks',()=>{
 const {audio,calls}=game();
 audio.startSpin();
 for (let i=0;i<5;i++) audio.stopReel(false);
 assert.deepEqual(calls.filter(c=>c[0]==='games/reelStopSingle').length,1);
 audio.startSpin();
 audio.stopReel(true);
 assert.deepEqual(calls.filter(c=>c[0]==='games/reelQuickstop').length,1);
});
test('award maps our symbol IDs to reference voices and delays the second voice by 0.6 seconds',()=>{
 const {audio,calls}=game();audio.award([8,1009,8],true);
 assert.deepEqual(calls.filter(c=>c[1]==='voice'),[
 ['games/voxPayoutHongzhong','voice',{delay:0}],
 ['games/voxPayoutFacai','voice',{delay:0.6}]]);
 assert.ok(calls.some(c=>c[0]==='games/symbolWild'&&c[2].delay===0.3));
});
test('three or more symbol wins alternate combined voices; no gold produces no Wild sound',()=>{
 const {audio,calls}=game();audio.award([2,3,4],false);audio.award([2,3,4],false);
 assert.deepEqual(calls.filter(c=>c[1]==='voice').map(c=>c[0]),['games/voxPayoutMultiSym01','games/voxPayoutMultiSym02']);
 assert.equal(calls.some(c=>c[0]==='games/symbolWild'),false);
});
test('mode changes switch background music once and custom multipliers do not fabricate a voice asset',()=>{
 const {audio,calls}=game();audio.setMode(false);audio.setMode(false);audio.setMode(true);audio.multiplier(1,'7');
 assert.deepEqual(calls.filter(c=>c[1]==='music').map(c=>c[0]),['bgm_mg','bgm_bonus_loop']);
 assert.equal(calls.some(c=>c[0]==='games/voxMultiply7x'),false);
});

test('user gesture resumes suspended audio and muting applies to all audio buses',async()=>{
 const ctx=context(),gains=[];ctx.state='suspended';
 const makeGain=ctx.createGain;ctx.createGain=()=>{const gain=makeGain();gains.push(gain);return gain;};
 const mixer=new WebAudioMixer('/audio/',()=>ctx,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}));
 mixer.setMuted(true);mixer.play('test');await flush();assert.equal(gains[0].gain.value,0);
 mixer.unlock();await flush();assert.equal(ctx.state,'running');
 mixer.setMuted(false);assert.equal(gains[0].gain.value,1);mixer.destroy();
});
test('every preloaded reference sound exists in both preview and build templates',()=>{
 const {audio,calls}=game();audio.initialize();
 const names=calls.find(c=>c[1]==='preload')[0];
 for(const folder of ['preview-template','build-templates/web-mobile'])
  for(const name of names) assert.ok(fs.statSync(require('node:path').join(__dirname,'..',folder,'audio',name+'.mp3')).size>0,name);
});

test('multiplier upgrades, popups and following awards do not cut off symbol voices',async()=>{
 const ctx=context();
 const create=ctx.createBufferSource;ctx.createBufferSource=()=>{const source=create();source.connect=node=>source.output=node;return source;};
 const mixer=new WebAudioMixer('/audio/',()=>ctx,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}));
 const audio=new GameAudio(mixer);
 audio.award([3,8],false);await flush();
 const voices=ctx.started.filter(source=>source.output===mixer.buses.get('voice'));
 assert.equal(voices.length,2);assert.equal(voices[1].when,10.6);
 audio.multiplier(1,'2');audio.beginPopup();audio.award([5],false);await flush();
 assert.equal(voices.some(source=>source.stopped),false,'both original symbol voices must finish, including the scheduled second voice');
 mixer.destroy();
});

test('Cocos loose-spread compilation still selects actual winning-symbol voices', t => {
 const path=require('node:path'),vm=require('node:vm');
 const babelRoot='/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules';
 if(!fs.existsSync(path.join(babelRoot,'@babel/core'))) { t.skip('requires the Cocos Creator compiler'); return; }
 const babel=require(path.join(babelRoot,'@babel/core'));
 const spread=require(path.join(babelRoot,'@babel/plugin-transform-spread'));
 const source=fs.readFileSync(path.join(__dirname,'../assets/mahjongway/src/audio/game_audio.ts'),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText;
 const compiled=babel.transformSync(js,{babelrc:false,configFile:false,plugins:[[spread,{loose:true}]]}).code;
 const calls=[],exports={};
 vm.runInNewContext(compiled,{exports,require:()=>({WebAudioMixer:class{}}),document:{documentElement:{setAttribute(){}}}});
 new exports.GameAudio({play(...args){calls.push(args);}}).award([4,7],false);
 assert.deepEqual(calls.filter(c=>c[1]==='voice').map(c=>c[0]),['games/voxPayout5tiao','games/voxPayoutBaiban']);
});
