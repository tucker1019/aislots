const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {GameAudio}=require('../assets/mahjongway/src/audio/game_audio.ts');
global.document={hidden:false,documentElement:{setAttribute(){}}};
function fixture(){const calls=[];return{calls,audio:new GameAudio({play:(...v)=>calls.push(v),stop:slot=>calls.push(['stop',slot]),unlock(){},setVolume(){},setMuted(){},preload(){},attach(){},destroy(){}})}}
test('idle voice starts after START and cycles through all eleven clips',()=>{
 const{audio,calls}=fixture();for(let i=0;i<20;i++)audio.updateIdle(1,true);assert.equal(calls.length,0);
 audio.start();for(let i=0;i<143;i++)audio.updateIdle(1,true);
 assert.deepEqual(calls.filter(c=>/^games\/voxRandom/.test(c[0])).slice(0,11).map(c=>c[0]),Array.from({length:11},(_,i)=>'games/voxRandom'+String(i+1).padStart(2,'0')));
});
test('spin, popup, hidden and mute suppress idle voice and stop a playing idle clip',()=>{
 const{audio,calls}=fixture();audio.start();for(let i=0;i<13;i++)audio.updateIdle(1,true);audio.startSpin();assert.ok(calls.some(c=>c[0]==='stop'&&c[1]==='voice:idle'));
 const count=()=>calls.filter(c=>/^games\/voxRandom/.test(c[0])).length;const before=count();
 for(let i=0;i<20;i++)audio.updateIdle(1,false);audio.beginPopup();for(let i=0;i<20;i++)audio.updateIdle(1,true);audio.stopPopup();
 document.hidden=true;for(let i=0;i<20;i++)audio.updateIdle(1,true);document.hidden=false;audio.toggleMuted();for(let i=0;i<20;i++)audio.updateIdle(1,true);assert.equal(count(),before);
});
