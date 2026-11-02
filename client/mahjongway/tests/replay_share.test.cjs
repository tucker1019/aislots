const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const ts=require('../../../slot_math/node_modules/typescript');require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(fs.readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),f);
const {replayShareURL,defaultApiBase}=require('../assets/mahjongway/src/history/replay_share.ts');
test('share URL carries only this site and the scoped replay capability, never login data',()=>{
 const url=new URL(replayShareURL('https://slots.example/play/?appkey=secret&uid=person&token=login&perf=1#private','bet/id','share-token'));
 assert.equal(url.origin,'https://slots.example');assert.equal(url.pathname,'/play/');assert.equal(url.hash,'');assert.equal(url.searchParams.get('replay'),'bet/id');assert.equal(url.searchParams.get('share'),'share-token');assert.deepEqual(Array.from(url.searchParams.keys()),['replay','share']);
});
test('production shared pages use same-origin API while local development keeps the local server',()=>{
 assert.equal(defaultApiBase('https://slots.example/play/'),'https://slots.example');assert.equal(defaultApiBase('http://127.0.0.1:5180/'),'http://127.0.0.1:8080');
});
test('public replay API sends no login token and cannot change the live nonce',async()=>{
 const {GameApi}=require('../assets/mahjongway/src/network/game/game_api.ts');const calls=[];
 const bet={betId:'bid',betAmount:'100',totalWinAmount:'0',profitAmount:'-100',winningRoundCount:0,totalRoundCount:0};
 const api=new GameApi('',undefined,async(path,body,token)=>{calls.push({path,body,token});if(path==='/login')return {accessToken:'login-secret'};if(path.endsWith('/state'))return {requestId:'live-next'};if(path.endsWith('/share'))return {betId:'bid',shareToken:'share-only'};if(path.includes('/shared-replays/'))return {bet,frames:[],amountScale:2};return {nextRequestId:'after'}});
 await api.login();await api.state();await api.createReplayShare('bid');await api.sharedReplay('bid','share-only');await api.spin('5',2);
 assert.equal(calls[2].token,'login-secret');assert.equal(calls[3].body,undefined);assert.equal(calls[3].token,undefined);assert.match(calls[3].path,/shared-replays\/bid\?share=share-only/);assert.equal(calls[4].body.requestId,'live-next');
});
