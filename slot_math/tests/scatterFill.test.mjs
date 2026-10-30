import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cascade,fill,setup,symbol,library} from './helpers/board.mjs';
function config(heights=[3,1,1]){return {...setup(heights),scatterWeightIncrement:10,symbols:[symbol('1'),symbol('2'),symbol('3'),symbol('11','scatter',1)],gold:{columns:[],baseProbability:0,freeProbability:0,wildSymbolId:null}};}
const seq=values=>{let i=0;return()=>{assert.ok(i<values.length);return values[i++];};};
const count=board=>board.flat().filter(c=>c.symbolId==='11').length;
const rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
test('free icon does not reset ordinary reinforcement, is removed for the rest of its column and restored in the next',()=>{
  const c=config(),source=fill.simulateBoard(c,'base',()=>0,[['1','2','1'],['3'],['2']]);
  const result=fill.fillBoard(source,c,2,seq([0,.99,.5,.99,0]));
  assert.deepEqual(result.round.board.map(c=>c.map(x=>x.symbolId)),[['1','11','1'],['11'],['1']]);
  assert.equal(result.metrics.scatterCount,2);assert.equal(result.round.totalPayout,0);
});
test('free weights restore base plus configured n in later columns, without accumulating base+2n',()=>{
  const c=config([1,1,1]);c.scatterWeightIncrement=2;
  const source=fill.simulateBoard(c,'base',()=>0,[['1'],['2'],['3']]);
  const result=fill.fillBoard(source,c,0,seq([.7,.45,.3]));
  // Reel1 picks normal3; reel2 keeps normal3; reel3 excludes3. Free remains3, so draw .3 picks normal2.
  assert.deepEqual(result.round.board.map(c=>c[0].symbolId),['3','3','2']);
});
test('a free icon survives and another may be added in the same column in a later refill',()=>{
  const c=config([2,2,2]);c.gold={columns:[2],baseProbability:0,freeProbability:0,wildSymbolId:'10'};
  c.symbols=[{...symbol('1'),payouts:{3:2}},{...symbol('2'),payouts:{}},symbol('10','wild',0),symbol('11','scatter',1)];
  const preset=[['1','11'],['1001','2'],['1','2']];
  const source=fill.simulateBoard(c,'base',()=>.75,preset);
  const result=fill.fillBoard(source,c,100,()=>.99,preset,64,3);
  assert.equal(source.steps.length,1);assert.equal(count(result.round.steps[0].before),1);
  assert.equal(result.round.board[0].filter(c=>c.symbolId==='11').length,2);
  assert.equal(count(result.round.board),3);
  assert.equal(result.round.totalPayout,source.totalPayout);
  const fresh=new Set(result.round.steps[0].refillIds);
  for(const column of result.round.board)assert.ok(column.filter(c=>fresh.has(c.id)&&c.symbolId==='11').length<=1);
});
test('triggered previews deliver exactly3/4/5 icons even with low configured weight, or clearly reject insufficient capacity',()=>{
  const c=config([2,2,2,2,2]);c.symbols.at(-1).weight=.000001;
  const source=fill.simulateBoard(c,'base',()=>0,[['1','1'],['2','2'],['3','3'],['1','1'],['2','2']]);
  for(const target of [3,4,5]){
    const result=fill.fillBoard(source,c,0,()=>0,undefined,64,target);
    assert.equal(count(result.round.board),target);for(const column of result.round.board)assert.ok(column.filter(c=>c.symbolId==='11').length<=1);
  }
  const small=config([1,1,1]),smallSource=fill.simulateBoard(small,'base',()=>0,[['1'],['2'],['3']]);
  assert.throws(()=>fill.fillBoard(smallSource,small,0,()=>0,undefined,64,4),/位置不足/);
  small.symbols.at(-1).weight=0;
  assert.throws(()=>fill.fillBoard(smallSource,small,0,()=>0,undefined,64,3),/权重为0/);
});
test('untriggered results have at most2 total new free icons, while all winning chains and stage limits remain unchanged',()=>{
  const c=config([3,3,3,3,3]);c.symbols.push(symbol('4'),symbol('5'));c.symbols.at(3).weight=30;
  for(let i=1;i<=30;i++){
    const source=fill.simulateBoard(c,'base',rng(i)),result=fill.fillBoard(source,c,100,rng(i+100));
    assert.ok(count(result.round.board)<=2);assert.equal(result.round.totalPayout,source.totalPayout);
    for(let step=0;step<source.steps.length;step++)assert.deepEqual(result.round.steps[step].wins,source.steps[step].wins);
    const initial=result.round.steps[0]?.before??result.round.board;
    for(const column of initial)assert.ok(column.filter(c=>c.symbolId==='11').length<=1);
    for(const step of result.round.steps){const born=new Set(step.refillIds);for(const col of step.after)assert.ok(col.filter(c=>born.has(c.id)&&c.symbolId==='11').length<=1);}
  }
});
test('scatter weights are editable but excluded from reference generation and compact skeletons',()=>{
  const c=config([2,2,2]);c.symbols.at(-1).weight=1e6;
  assert.doesNotThrow(()=>cascade.validateCascadeConfig(c));
  for(const random of [()=>0,()=>.9999])assert.ok(cascade.createCascadeRound(c,random).board.flat().every(c=>c.symbolId!=='11'));
  const gen=new library.LibraryGenerator(c,{mode:'base',count:50,seed:1,perMultiplier:2},rng(1));while(!gen.done)gen.step(5);
  for(const rows of Object.values(gen.buckets))for(const skeleton of rows){let p=0;while(p<skeleton.length){const n=skeleton[p++];for(let i=0;i<n;i++){p++;assert.notEqual(skeleton[p++],11);}}}
});
