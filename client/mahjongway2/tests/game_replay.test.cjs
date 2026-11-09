const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpile(fs.readFileSync(f,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),f);
const {loadReplay,ReplaySession}=require('../assets/mahjongway/src/history/replay_session.ts');
const frame=(spin,step)=>({betId:'trade/1',spinIndex:spin,stepIndex:step,board:[[]]});
test('replay loads every page through the encoded trade API without calling spin',async()=>{
 const calls=[];const api={historyReplay:async(id,cursor)=>{calls.push([id,cursor]);return {bet:{betId:id,status:'complete'},frames:cursor?[frame(1,2)]:[frame(0,1)],nextCursor:cursor?undefined:'page2'}},spin(){assert.fail('must not bet')}};
 const data=await loadReplay(api,'trade/1');assert.equal(data.frames.length,2);assert.deepEqual(calls,[['trade/1',undefined],['trade/1','page2']]);
});
test('replay rejects cross-trade responses, duplicate frames and looping cursors',async()=>{
 await assert.rejects(loadReplay({historyReplay:async()=>({bet:{betId:'other'},frames:[frame(0,1)]})},'trade/1'),/交易/);
 await assert.rejects(loadReplay({historyReplay:async()=>({bet:{betId:'trade/1'},frames:[frame(0,1),frame(0,1)]})},'trade/1'),/顺序/);
 await assert.rejects(loadReplay({historyReplay:async()=>({bet:{betId:'trade/1'},frames:[frame(0,1)],nextCursor:'same'})},'trade/1'),/分页|顺序/);
});
test('cancelled loads do not open a replay after history closes',async()=>{
 let current=true;await assert.rejects(loadReplay({historyReplay:async()=>{current=false;return {bet:{betId:'trade/1'},frames:[frame(0,1)]}}},'trade/1',()=>current),/取消/);
});
test('session only consumes historical frames and cancellation stops all future frames',()=>{
 const source=[frame(0,1),frame(0,2),frame(1,3)];const session=new ReplaySession(source);assert.equal(session.current.spinIndex,0);assert.equal(session.advance().stepIndex,2);session.cancel();assert.equal(session.advance(),undefined);assert.equal(source.length,3);
});
test('real GameApi replay calls are read-only and leave the next live nonce intact',async()=>{
 const {GameApi}=require('../assets/mahjongway/src/network/game/game_api.ts');const calls=[];
 const record={betId:'trade/1',betAmount:'1000',totalWinAmount:'0',profitAmount:'-1000',winningRoundCount:0,totalRoundCount:1,status:'complete'};
 const api=new GameApi('',undefined,async(route,body)=>{calls.push([route,body]);if(route.endsWith('/state'))return {requestId:'live-next',hasNext:false};if(route.includes('/replay?'))return {bet:record,amountScale:2,frames:[{...frame(0,1),chargeAmount:'1000',profitAmount:'-1000',payouts:[],wins:[]}]};return {nextRequestId:'after-live'}});
 await api.state();await loadReplay(api,'trade/1');assert.equal(calls.length,2);assert.match(calls[1][0],/trade%2F1\/replay\?/);assert.equal(calls[1][1],undefined);
 await api.spin('5',2);assert.deepEqual(calls[2][1],{requestId:'live-next',bet:'5',betLevel:2});
});
