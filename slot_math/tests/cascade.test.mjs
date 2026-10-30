import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascade, setup, symbol } from './helpers/board.mjs';
const { createCascadeRound, advanceCascadeRound, evaluateWays, validateCascadeConfig, validateBoard, cascadeFactor } = cascade;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test('variable heights and ways example [2,1,3,3] retain line normalization', () => {
  const config = setup([2,1,3,3]), round = createCascadeRound(config, () => 0, [['A','A'],['A'],['A','A','A'],['A','A','A']]);
  const wins = evaluateWays(round.board, config, 0);
  assert.equal(wins.length, 1); assert.deepEqual(wins[0].counts, [2,1,3,3]); assert.equal(wins[0].ways, 18); close(wins[0].payout, 10/20*18);
});
test('shared wild pays A and B separately, and is removed only once', () => {
  const config = setup([2,2,1]); config.symbols.find(s => s.id === 'B').payouts = {3:5};
  const round = createCascadeRound(config, () => 0, [['A','B'],['A','B'],['W']]);
  const result = advanceCascadeRound(round, config, () => 0);
  assert.equal(result.steps[0].wins.length, 2); assert.equal(result.steps[0].removedIds.length, 5); assert.equal(result.steps[0].refillIds.length, 5); close(result.totalPayout, .5);
});
test('leftmost uninterrupted run uses longest-run payout only', () => {
  const config = setup([1,1,1,1]);
  const none = createCascadeRound(config, () => 0, [['B'],['A'],['A'],['A']]); assert.equal(evaluateWays(none.board, config, 0).length, 0);
  const yes = createCascadeRound(config, () => 0, [['A'],['A'],['A'],['A']]); const wins = evaluateWays(yes.board, config, 0);
  assert.equal(wins[0].columns, 4); assert.equal(wins.length, 1); close(wins[0].payMultiplier, .5);
});
test('all wilds do not pay unrelated ordinary symbols', () => {
  const config = setup(), round = createCascadeRound(config, () => 0, [['W'],['W'],['W']]); assert.deepEqual(evaluateWays(round.board, config, 0), []);
});
test('gravity preserves survivor order and new cells enter at the top', () => {
  const config = setup([3,1,1]), round = createCascadeRound(config, () => 0, [['S','A','B'],['A'],['A']]);
  const after = advanceCascadeRound(round, config, () => 0);
  assert.deepEqual(after.board[0].slice(1).map(c => c.id), [round.board[0][0].id, round.board[0][2].id]);
  assert.equal(after.board[0][0].symbolId, 'B'); assert.deepEqual(after.board.map(c => c.length), [3,1,1]);
});
test('reserved free icons never generate free sessions, awards or special payout factors', () => {
  const config = setup(), round = createCascadeRound(config, () => 0, [['S'],['S'],['S']]);
  const result = advanceCascadeRound(round, config, () => 0);
  assert.equal(result.finished, true); close(result.totalPayout, 0);
  for (const field of ['isFree', 'freeAward', 'scatterCount', 'seenScatterIds']) assert.equal(field in result, false);
  assert.equal(advanceCascadeRound(result, config, () => 0), result);
  assert.equal(cascadeFactor(config, 0), 1); assert.equal(cascadeFactor(config, 100), 5);
});
test('reserved free icons are excluded from initial and refill sampling', () => {
  const config = setup([2,2,2]);
  for (const random of [() => 0, () => .9999999]) {
    const generated = createCascadeRound(config, random);
    assert.ok(generated.board.flat().every(cell => cell.symbolId !== 'S'));
    const preset = createCascadeRound(config, random, [['A','S'],['A','S'],['A','S']]);
    const after = advanceCascadeRound(preset, config, random);
    assert.equal(after.board.flat().filter(cell => cell.symbolId === 'S').length, 3);
    assert.ok(after.steps[0].refillIds.every(id => after.board.flat().find(cell => cell.id === id).symbolId !== 'S'));
  }
});
test('cascade factors restart for a new board, and line count scales payouts once', () => {
  const a = setup(), b = { ...a, lineCount: 40 };
  const first = createCascadeRound(a, () => 0, [['A'],['A'],['A']]);
  const second = createCascadeRound(b, () => 0, [['A'],['A'],['A']]);
  close(evaluateWays(first.board, a, 1)[0].payout, .5);
  close(evaluateWays(second.board, b, 0)[0].payout, .125);
  assert.equal(cascadeFactor(a, first.steps.length), 1);
});
test('infinite wins stop explicitly without marking an incomplete board finished', () => {
  const config = setup(); config.symbols = [symbol('A')]; let round = createCascadeRound(config, () => 0);
  for (let i = 0; i < 101; i++) round = advanceCascadeRound(round, config, () => 0);
  assert.equal(round.steps.length, 100); assert.equal(round.limited, true); assert.equal(round.finished, false);
});
test('source board and prior round remain immutable across each step', () => {
  const config = setup(), round = createCascadeRound(config, () => 0, [['A'],['A'],['A']]), original = JSON.stringify(round);
  advanceCascadeRound(round, config, () => 0); assert.equal(JSON.stringify(round), original);
});
test('invalid configuration, colors, weights and preset cells are rejected', () => {
  for (const patch of [{columnHeights:[0,2,3]}, {columnHeights:[2,3]}, {lineCount:0}, {symbols:[]}, {cascadeFactors:[]}, {symbols:[symbol('S','scatter',1)]}, {symbols:[{...symbol('A'),color:'invalid'}]}, {symbols:[{...symbol('A'),payouts:[]}]}]) assert.throws(() => validateCascadeConfig({...setup(),...patch}));
  assert.doesNotThrow(() => validateCascadeConfig({...setup(),symbols:[]}, true));
  const config = setup();
  for (const preset of [[['UNKNOWN'],['A'],['A']], [['A']], [['A','A'],['A'],['A']]]) assert.throws(() => createCascadeRound(config, () => 0, preset));
  for (const value of [-1, 1, NaN]) assert.throws(() => createCascadeRound(config, () => value));
});
test('board inspection rejects invalid shape, unknown symbols and duplicate cell IDs', () => {
  const config = setup(), round = createCascadeRound(config, () => 0);
  const duplicate = structuredClone(round.board); duplicate[1][0].id = duplicate[0][0].id;
  assert.throws(() => validateBoard(duplicate, config));
  const unknown = structuredClone(round.board); unknown[0][0].symbolId = 'missing'; assert.throws(() => evaluateWays(unknown, config, 0));
  assert.throws(() => validateBoard(round.board.slice(1), config));
});

test('base and free ladders have independent values, lengths and repeating tails', () => {
  const config = setup(); config.freeCascadeFactors = [3, 7];
  assert.deepEqual([0, 1, 2, 9].map(i => cascadeFactor(config, i)), [1, 2, 3, 5]);
  assert.deepEqual([0, 1, 2, 9].map(i => cascadeFactor(config, i, 'free')), [3, 7, 7, 7]);
  config.cascadeFactors[0] = 9;
  assert.equal(cascadeFactor(config, 0, 'free'), 3);
});
test('same board uses selected mode through the entire cascade and resets each round', () => {
  const config = setup(); config.freeCascadeFactors = [3, 7]; config.symbols = [symbol('A')];
  let base = createCascadeRound(config, () => 0);
  let free = createCascadeRound(config, () => 0, undefined, 'free');
  assert.deepEqual(base.board, free.board);
  for (const [baseFactor, freeFactor] of [[1,3],[2,7],[3,7]]) {
    base = advanceCascadeRound(base, config, () => 0);
    free = advanceCascadeRound(free, config, () => 0);
    assert.equal(base.steps.at(-1).factor, baseFactor);
    assert.equal(free.steps.at(-1).factor, freeFactor);
    close(base.steps.at(-1).payout, 5 / 20 * baseFactor);
    close(free.steps.at(-1).payout, 5 / 20 * freeFactor);
    assert.deepEqual(base.board, free.board);
  }
  const next = advanceCascadeRound(createCascadeRound(config, () => 0, undefined, 'free'), config, () => 0);
  assert.equal(next.steps[0].factor, 3);
  assert.throws(() => createCascadeRound(config, () => 0, undefined, 'unknown'));
});
test('free ladder is required and validated independently', () => {
  for (const factors of [undefined, [], [0], [-1], [NaN], [Infinity], Array(31).fill(1)]) {
    assert.throws(() => validateCascadeConfig({...setup(),freeCascadeFactors:factors}), /免费连续消除加成/);
  }
});
