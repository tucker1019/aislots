import test from 'node:test';
import assert from 'node:assert/strict';
import { GameApi } from '../.test-build/network/game_api.mjs';
import { adaptFrame, activeColumns } from '../.test-build/network/frame_adapter.mjs';
const heights=[3,4,5,5,4,3];
const frame=(extra={})=>({requestId:'r1',nextRequestId:'r2',betId:'b',spinIndex:0,stepIndex:1,mode:'base',nextAction:'continue',previewRows:1,board:heights.map((h,c)=>Array.from({length:h+1},(_,r)=>({id:c*10+r,symbolId:r===0?10:r}))),wins:[{symbolId:1,cellIds:[1,11,21]}],removedIds:[1,11],transformedIds:[21],balance:10000,betAmount:200,winAmount:20,totalWinAmount:20,freeRemaining:0,cascadeFactors:['1','2','4'],cascadeIndex:0,...extra});
test('maps active rows bottom-up and excludes preview, preserves win coordinates',()=>{
 const f=frame();f.board[2][1].symbolId=1001; const v=adaptFrame(f);
 assert.deepEqual(activeColumns(f)[0],[3,2,1]);
 assert.equal(v.icons[12],1);assert.equal(v.icons[22],1001);
 assert.deepEqual(v.awards[0].mIconIdxs,[13,19,23]);assert.equal(v.awards[0].mMoney,20);assert.deepEqual(v.transformedPositions,[23]);assert.deepEqual(v.removedPositions,[13,19]);
});
test('uses server multiplier and rejects absent win cell IDs',()=>{
 assert.equal(adaptFrame(frame({mode:'free',cascadeFactors:['8','16'],cascadeIndex:1})).factor,16);
 assert.throws(()=>adaptFrame(frame({wins:[{symbolId:1,cellIds:[999]}]})),/cell/i);
});
test('timeout preserves request ID and wager; successful continuation uses next ID',async()=>{
 const calls=[];let failed=true;
 const request=async(path,body)=>{calls.push({path,body});if(path.endsWith('/state'))return {requestId:'r1',balance:10000,hasNext:false};if(failed){failed=false;throw Error('timeout');}return frame();};
 const api=new GameApi('',request);await api.state();await assert.rejects(api.spin(10,1));await api.spin(999,9);
 assert.deepEqual(calls[1].body,calls[2].body);assert.deepEqual(calls[1].body,{requestId:'r1',bet:'10',betLevel:1});assert.ok(calls[1].path.includes('/AG3/'));
 await api.spin(10,1);assert.equal(calls[3].body.requestId,'r2');
});
test('serializes concurrent calls; state does not settle a round',async()=>{
 let count=0;const api=new GameApi('',async(path)=>{if(path.endsWith('/state'))return {requestId:'r1',balance:0,hasNext:true,lastFrame:frame()};count++;await new Promise(r=>setTimeout(r,5));return frame();});
 await api.state();assert.equal(count,0);await Promise.all([api.spin(10,1),api.spin(10,1)]);assert.equal(count,1);
});

test('free transitions use terminal receipt; last free spin can retrigger',async()=>{
 const {describeFrame}=await import('../.test-build/network/round_controller.mjs');
 assert.equal(describeFrame(frame({triggeredFree:true,nextAction:'continue',freeRemaining:10})).transition,'cascade');
 assert.equal(describeFrame(frame({triggeredFree:true,nextAction:'start_free',freeRemaining:10})).transition,'enter-free');
 assert.equal(describeFrame(frame({mode:'free',nextAction:'start_free',awardedFreeSpins:10,freeRemaining:10})).transition,'retrigger');
 assert.equal(describeFrame(frame({mode:'free',nextAction:'complete',freeRemaining:0})).transition,'end-free');
});

test('shared replay performs only public GET and never exchanges a live ticket',async()=>{
 const calls=[];const record={betId:'b',betAmount:'200',totalWinAmount:'20',profitAmount:'-180',winningRoundCount:1,totalRoundCount:2};
 const api=new GameApi('',async(path,body,token)=>{calls.push({path,body,token});return {bet:record,frames:[{...frame(),chargeAmount:'200',profitAmount:'-180',payouts:[]}],amountScale:2};});
 const data=await api.sharedReplay('b','public-only');assert.equal(data.bet.betId,'b');assert.equal(calls.length,1);assert.ok(calls[0].path.includes('/shared-replays/b?share=public-only'));assert.equal(calls[0].body,undefined);assert.equal(calls[0].token,undefined);
});

test('one settled frame is presented once even if native stop callback repeats',async()=>{
 const {FrameGate}=await import('../.test-build/network/round_controller.mjs');const gate=new FrameGate();
 assert.equal(gate.accept(frame()),true);assert.equal(gate.accept(frame()),false);assert.equal(gate.accept(frame({requestId:'r2',stepIndex:2})),true);
 gate.reset();assert.equal(gate.accept(frame()),true);
});

test('minor units retain cents, and completed free receipt restores base controls',async()=>{
 const {formatMinor,restoredFree}=await import('../.test-build/network/display.mjs');
 assert.equal(formatMinor(100020),'1,000.20');assert.equal(formatMinor(5),'0.05');
 assert.equal(restoredFree(frame({mode:'free',nextAction:'complete'})),false);
 assert.equal(restoredFree(frame({mode:'free',nextAction:'continue'})),true);
});

test('auto budget permits exactly the selected paid spins and can be stopped',async()=>{
 const {AutoBudget}=await import('../.test-build/network/round_controller.mjs');
 for(const selected of [1,10,30]){const budget=new AutoBudget();budget.set(selected);let spins=0;while(budget.take())spins++;assert.equal(spins,selected);assert.equal(budget.remaining,0);}
 const budget=new AutoBudget();budget.set(10);budget.take();budget.set(0);assert.equal(budget.take(),false);
});

test('fit policy changes when a wide preview becomes a portrait phone',async()=>{
 const {resolutionFit}=await import('../.test-build/network/display.mjs');
 assert.equal(resolutionFit(1280,720),'height');assert.equal(resolutionFit(412,824),'width');assert.equal(resolutionFit(320,720),'width');
});

test('local AG3 static origin resolves the game API to 8080, with explicit overrides preserved',async()=>{
 const {resolveApiBase}=await import('../.test-build/network/launch_session.mjs');
 assert.equal(resolveApiBase('http://127.0.0.1:5182/?launchTicket=abc'),'http://127.0.0.1:8080');
 assert.equal(resolveApiBase('http://localhost:5182/'),'http://127.0.0.1:8080');
 assert.equal(resolveApiBase('http://127.0.0.1:5183/?api=http%3A%2F%2F127.0.0.1%3A5183'),'http://127.0.0.1:5183');
 assert.equal(resolveApiBase('https://testgame.example/AG3/'),'https://testgame.example');
 assert.throws(()=>resolveApiBase('http://127.0.0.1:5182/?api=javascript:bad'),/API/);
});
