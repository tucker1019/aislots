import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cascade,fill,setup,symbol,board} from './helpers/board.mjs';
const {fillBoard,simulateBoard,measureScenes}=fill;
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function config(heights=[2,2,1]){return {...setup(heights),symbols:[symbol('1'),symbol('2'),symbol('3'),symbol('4'),symbol('10','wild',0)],gold:{columns:[],baseProbability:0,freeProbability:0,wildSymbolId:'10'}};}
const sequence=values=>{let i=0;return()=>{assert.ok(i<values.length);return values[i++];};};
const wins=round=>round.steps.map(s=>s.wins.map(w=>[w.symbolId,w.columns,w.ways,w.cellIds,w.payout]));
test('reinforcement persists within a column and into the second column, while the third column is blocked',()=>{
  const c=config();
  const source=simulateBoard(c,'base',()=>0,[['1','2'],['3','3'],['4']]);
  const weighted=fillBoard(source,c,2,sequence([0,.4,.4,.4,.4]));
  const plain=fillBoard(source,c,0,sequence([0,.4,.4,.4,.4]));
  assert.deepEqual(weighted.round.board[0].map(c=>c.symbolId),['1','1']);
  assert.deepEqual(weighted.round.board[1].map(c=>c.symbolId),['1','1']);
  assert.notEqual(weighted.round.board[2][0].symbolId,'1');
  assert.deepEqual(plain.round.board[0].map(c=>c.symbolId),['1','2']);
  assert.equal(weighted.round.totalPayout,0);assert.equal(weighted.metrics.filledCells,5);
  assert.ok(measureScenes(weighted.round,c).repeated>measureScenes(plain.round,c).repeated);
});
test('a fixed wild in reel three excludes matching candidates in reel two before filling reel three',()=>{
  const c=config([1,1,1]);
  const source=simulateBoard(c,'base',()=>0,[['1'],['2'],['10']]);
  const result=fillBoard(source,c,100,()=>0,[[null],[null],['10']]);
  assert.equal(result.round.board[0][0].symbolId,'1');
  assert.notEqual(result.round.board[1][0].symbolId,'1');
  assert.equal(result.round.board[2][0].symbolId,'10');assert.equal(result.round.totalPayout,0);
});
test('gold conversion, falling and later winners are preserved across the complete filled chain',()=>{
  const c=config([2,2,2,2,2]);c.gold.columns=[2,3,4];
  c.symbols[0].payouts={3:2};c.symbols[1].payouts={};c.symbols[2].payouts={3:1};c.symbols[3].payouts={};
  const source=simulateBoard(c,'base',()=>.99,[['1','3'],['1001','2'],['1','3'],['4','4'],['4','4']]);
  assert.equal(source.steps.length,2);
  const original=JSON.stringify(source);
  const result=fillBoard(source,c,100,rng(4));
  assert.deepEqual(wins(result.round),wins(source));assert.equal(result.round.totalPayout,source.totalPayout);
  assert.deepEqual(result.round.steps.map(s=>s.transformedIds),source.steps.map(s=>s.transformedIds));
  assert.equal(JSON.stringify(source),original);
});
test('manual cells stay fixed and unknown holes alone are filled',()=>{
  const c=config([1,1,1]);const source=simulateBoard(c,'base',()=>0,[['1'],['2'],['3']]);
  const result=fillBoard(source,c,100,()=>0,[['1'],['2'],['3']]);
  assert.deepEqual(result.round.board,source.board);assert.equal(result.metrics.filledCells,0);
});
test('impossible candidate pools stop at the attempt limit instead of returning an altered prize',()=>{
  const c=config([2,2,2,1]);c.symbols=[symbol('1'),symbol('2'),symbol('11','scatter',0)];c.gold.wildSymbolId=null;
  const source=simulateBoard(c,'base',sequence([0,0,.99,.99,0,0]),[['1','2'],['1','2'],['1','2'],['11']]);
  assert.throws(()=>fillBoard(source,c,100,()=>0,undefined,2),/补空2次/);
  assert.throws(()=>fillBoard(source,c,-1,()=>0));
});
test('near-miss, high-payout and within-column repetition metrics have explicit denominators',()=>{
  const c=config();const source=simulateBoard(c,'base',()=>0,[['1','1'],['1','1'],['4']]);
  const metrics=measureScenes(source,c);
  assert.deepEqual(metrics,{twoFree:0,scenes:1,nearMiss:1,highNearMiss:1,repeated:2,normalCells:5});
});
test('many independently sampled chains retain exactly the original winners and total payout in both modes',()=>{
  const c=config([2,2,2,2,2]);c.gold={columns:[2,3,4],baseProbability:.083,freeProbability:.11,wildSymbolId:'10'};
  for(const mode of ['base','free'])for(let seed=1;seed<=40;seed++){
    const source=simulateBoard(c,mode,rng(seed));
    const result=fillBoard(source,c,100,rng(seed+10000));
    assert.deepEqual(wins(result.round),wins(source));assert.equal(result.round.totalPayout,source.totalPayout);
    assert.deepEqual(cascade.evaluateWays(result.round.board,c,result.round.steps.length,mode),[]);
  }
});
test('the configured reinforcement value round trips without runtime defaults',()=>{
  const c=config();c.fillWeightIncrement=125;
  const {lineCount,...file}=c;file.version=1;file.seed=null;
  assert.equal(board.fileFromBoard(board.runtimeBoardConfig(file,20),'').fillWeightIncrement,125);
  const missing={...file};delete missing.fillWeightIncrement;assert.throws(()=>board.validateBoardFile(missing),/补空累计加权/);
});
test('same seed and n=0 produce an identical control pair, and each new round resets reinforcement',()=>{
  const c=config();const source=simulateBoard(c,'base',()=>0,[['1','2'],['3','3'],['4']]);
  const a=fillBoard(source,c,0,rng(42)),b=fillBoard(source,c,0,rng(42));
  assert.deepEqual(a.round,b.round);assert.deepEqual(measureScenes(a.round,c),measureScenes(b.round,c));
  const boosted=fillBoard(source,c,100,rng(42)),again=fillBoard(source,c,100,rng(42));
  assert.deepEqual(boosted.round,again.round);
});
test('lookahead preserves a multi-cascade board with nine weighted symbols and future gold/wild interactions',()=>{
  const c=config([4,5,5,5,4]);c.gold={columns:[2,3,4],baseProbability:.083,freeProbability:.11,wildSymbolId:'10'};
  c.symbols=Array.from({length:9},(_,i)=>({...symbol(String(i+1)),weight:1000+i*40,payouts:{3:i+1,4:(i+1)*2,5:(i+1)*5}}));c.symbols.push(symbol('10','wild',0));
  let state=42;const random=()=>{state=(state+0x6D2B79F5)>>>0;let x=Math.imul(state^(state>>>15),1|state);x^=x+Math.imul(x^(x>>>7),61|x);return((x^(x>>>14))>>>0)/4294967296;};
  for(let i=0;i<10;i++){const source=simulateBoard(c,'base',random);const result=fillBoard(source,c,100,random);assert.deepEqual(wins(result.round),wins(source));assert.equal(result.round.totalPayout,source.totalPayout);}
});
