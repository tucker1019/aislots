import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascade, setup, symbol } from './helpers/board.mjs';
const {createCascadeRound, advanceCascadeRound, evaluateWays, validateCascadeConfig, symbolDefinitions} = cascade;
function goldSetup(heights = [1,1,1,1,1]) {
  return {...setup(heights),gold:{columns:[2,3,4],baseProbability:.083,freeProbability:.11,wildSymbolId:'10'},symbols:[symbol('1'),{...symbol('2'),payouts:{}},symbol('10','wild',0),symbol('11','scatter',0)]};
}
const sequence = values => {let index = 0; return () => {assert.ok(index < values.length, 'unexpected extra random draw'); return values[index++];};};
test('base and free gold probabilities use strict independent per-cell thresholds only on reels 2–4', () => {
  for (const [mode, threshold] of [['base',.083],['free',.11]]) {
    const config = goldSetup();
    const round = createCascadeRound(config,sequence([0,0,threshold-1e-9,0,threshold,0,threshold-1e-9,0]),undefined,mode);
    assert.deepEqual(round.board.flat().map(c => c.symbolId), ['1','1001','1','1001','1']);
  }
  const config = goldSetup(); config.gold.baseProbability = 0; config.gold.freeProbability = 1;
  assert.ok(createCascadeRound(config,()=>0).board.flat().every(c => c.symbolId === '1'));
  assert.deepEqual(createCascadeRound(config,()=>0,undefined,'free').board.flat().map(c=>c.symbolId), ['1','1001','1001','1001','1']);
});
test('gold is the same paying symbol, not a separate Ways combination, with line scaling exactly once', () => {
  const config = goldSetup([2,2,1,1,1]); config.gold.baseProbability = 0;
  const round = createCascadeRound(config,()=>0,[['1','1'],['1','1001'],['1'],['2'],['2']]);
  const wins = evaluateWays(round.board, config, 0);
  assert.equal(wins.length,1); assert.equal(wins[0].symbolId,'1'); assert.equal(wins[0].ways,4);
  assert.equal(wins[0].payout,5/20*4); assert.equal(wins[0].cellIds.length,5);
});
test('winning gold converts in place then falls, participates next round and the wild is later removed', () => {
  const config = goldSetup([1,3,1,1,1]); config.gold.baseProbability = 0;
  const round = createCascadeRound(config,()=>0,[['1'],['1001','1','2'],['1'],['2'],['2']]);
  const original = JSON.stringify(round), goldId = round.board[1][0].id;
  const next = advanceCascadeRound(round,config,()=>0);
  assert.equal(JSON.stringify(round),original);
  assert.deepEqual(next.steps[0].transformedIds,[goldId]);
  assert.equal(next.steps[0].removedIds.length,3); assert.equal(next.steps[0].refillIds.length,3);
  assert.equal(next.steps[0].wins[0].counts[1],2);
  assert.deepEqual(next.board[1].map(c=>c.symbolId),['1','10','2']);
  assert.equal(next.board[1][1].id,goldId);
  const afterWild = advanceCascadeRound(next,config,()=>0);
  assert.ok(afterWild.steps[1].removedIds.includes(goldId));
  assert.equal(afterWild.board.flat().some(c=>c.id === goldId),false);
  assert.deepEqual(afterWild.steps[1].transformedIds,[]);
});
test('nonwinning gold survives without rerolling its background', () => {
  const config = goldSetup([1,2,1,1,1]);
  const round = createCascadeRound(config,()=>0,[['1'],['1','1002'],['1'],['2'],['2']]);
  const gold = round.board[1][1];
  const next = advanceCascadeRound(round,config,()=>0);
  assert.equal(next.board[1].at(-1),gold);
  assert.deepEqual(next.steps[0].transformedIds,[]);
});
test('refills apply the selected mode gold probability only to newly generated cells', () => {
  const config = goldSetup(); config.gold.baseProbability = 0; config.gold.freeProbability = 1;
  const preset = [['1'],['1'],['1'],['1'],['1']];
  for (const mode of ['base','free']) {
    const next = advanceCascadeRound(createCascadeRound(config,()=>0,preset,mode),config,()=>0);
    assert.deepEqual(next.board.flat().map(c=>c.symbolId), mode === 'base' ? ['1','1','1','1','1'] : ['1','1001','1001','1001','1']);
  }
});
test('invalid gold config, reserved IDs, wild sampling and invalid manual gold are rejected', () => {
  const changes = [c=>delete c.gold,c=>c.gold.baseProbability=1.01,c=>c.gold.freeProbability=-1,c=>c.gold.columns=[2,2],c=>c.gold.columns=[0],c=>c.gold.wildSymbolId='1',c=>c.gold.wildSymbolId=null,c=>c.symbols[0].id='1001',c=>c.symbols[0].id='A',c=>c.symbols[2].weight=1];
  for (const change of changes) { const config = goldSetup(); change(config); assert.throws(()=>validateCascadeConfig(config)); }
  for (const preset of [[['1001'],['1'],['1'],['1'],['1']],[['1'],['1010'],['1'],['1'],['1']],[['1'],['9999'],['1'],['1'],['1']]]) assert.throws(()=>createCascadeRound(goldSetup(),()=>0,preset));
  assert.throws(()=>createCascadeRound(goldSetup(),sequence([0,0,NaN])));
  const definitions = symbolDefinitions(goldSetup()); assert.equal(definitions.get('1001').baseSymbolId,'1'); assert.equal(definitions.has('1010'),false);
});

test('free fixed reels replace random gold and preserve Wild and Scatter', () => {
  const config = {...goldSetup([1,1,4,1,1]), freeGoldColumns:[3]};
  config.gold.freeProbability = 1;
  const preset = [['1'],['1'],['1','2','10','11'],['2'],['2']];
  const round = createCascadeRound(config, () => 0, preset, 'free');
  assert.deepEqual(round.board[2].map(c=>c.symbolId), ['1001','1002','10','11']);
  assert.deepEqual(round.board.map(c=>c[0].symbolId), ['1','1','1001','2','2']);
  const next = advanceCascadeRound(round,config,()=>0);
  assert.ok(next.steps[0].transformedIds.includes(round.board[2][0].id));
  assert.ok(next.board[2].every(c=>['1001','1002','10','11'].includes(c.symbolId)));
});
