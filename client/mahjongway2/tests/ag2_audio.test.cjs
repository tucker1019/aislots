const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {GameAudio}=require('../assets/mahjongway2/src/audio/game_audio.ts');
global.document={hidden:false,documentElement:{setAttribute(){}}};
function fixture(){const events=[];const audio=new GameAudio({play:(...v)=>events.push(v),stop:name=>events.push(['stop',name]),setMuted(){},setVolume(){},attach(){},preload(){},destroy(){},unlock(){}});return{audio,events};}
test('free music uses the reference bgm_fs and normal mode restores bgm_mg',()=>{const{audio,events}=fixture();audio.start();audio.setMode(true);audio.setMode(false);assert.deepEqual(events.filter(e=>e[1]==='music').map(e=>e[0]),['bgm_mg','bgm_fs','bgm_mg']);});
test('medium award follows the reference high symbols and gold symbols retain their voice',()=>{for(const id of[1,2,3,4,5,6,7,8,9]){const{audio,events}=fixture();audio.award([id+1000],false);assert.ok(events.some(e=>e[0]==='games/'+(id>=6?'prizeMedwin':'prizeSmallwin')),String(id));}});
test('idle voice cycles only after start while idle and stops for spins and popups',()=>{const{audio,events}=fixture();for(let i=0;i<20;i++)audio.updateIdle(1,true);assert.equal(events.length,0);audio.start();for(let i=0;i<11;i++)for(let n=0;n<13;n++)audio.updateIdle(1,true);const voices=events.filter(e=>/^games\/voxRandom/.test(e[0])).map(e=>e[0]);assert.deepEqual(voices.slice(0,11),Array.from({length:11},(_,i)=>'games/voxRandom'+String(i+1).padStart(2,'0')));audio.startSpin();assert.ok(events.some(e=>e[0]==='stop'&&e[1]==='voice:idle'));const before=events.length;for(let i=0;i<20;i++)audio.updateIdle(1,false);assert.equal(events.length,before);audio.beginPopup();for(let i=0;i<20;i++)audio.updateIdle(1,true);assert.equal(events.length,before);});
test('preview and build templates contain the exact reference audio assets',()=>{
 const root=path.join(__dirname,'..');const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/audio_reference_manifest.json')));
 assert.equal(manifest.source,'mahjongway2_1024');assert.ok(manifest.files['bgm_fs.mp3']);
 for(const folder of['preview-template/audio','build-templates/web-mobile/audio'])for(const[file,hash]of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,folder,file))).digest('hex'),hash,file);
});
test('idle voice is suppressed while hidden or muted',()=>{const{audio,events}=fixture();audio.start();const count=()=>events.filter(e=>/^games\/voxRandom/.test(e[0])).length;document.hidden=true;for(let i=0;i<20;i++)audio.updateIdle(1,true);assert.equal(count(),0);document.hidden=false;audio.toggleMuted();for(let i=0;i<20;i++)audio.updateIdle(1,true);assert.equal(count(),0);});
test('audio fetch URL includes a content revision so an old same-name track is not reused',async()=>{
 const {WebAudioMixer}=require('../assets/mahjongway2/src/audio/web_audio.ts');let url;
 const mixer=new WebAudioMixer('http://localhost/audio/',()=>({destination:{},createGain:()=>({gain:{value:1},connect(){}}),decodeAudioData:async()=>({})}),async value=>{url=value;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}});
 await mixer.load(['bgm_mg'],()=>{});assert.match(url,/bgm_mg\.mp3\?v=[a-f0-9]{12}$/);
});
