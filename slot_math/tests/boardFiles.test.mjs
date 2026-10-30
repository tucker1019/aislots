import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { createGameStore, createBoardStore, createGameMiddleware } from '../server/game-files.mjs';
import { board, boardFixture } from './helpers/board.mjs';
import { settings, readFixture } from './helpers/settings.mjs';
async function fixture(t, overrides) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'slot-board-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'AG1'));
  for (const [name, value] of Object.entries({ ...readFixture(), board: boardFixture() })) await fs.writeFile(path.join(root, 'AG1', `${name}.json`), JSON.stringify(value, null, 2) + '\n');
  return { root, gameStore: createGameStore(root, settings.validateGameFiles), store: createBoardStore(root, board.validateBoardFile, overrides ? {...fs,...overrides} : fs) };
}
test('board file round trips layout, symbols and raw payouts without duplicating line count', () => {
  const file = boardFixture(), config = board.runtimeBoardConfig(file, 20);
  const saved = board.fileFromBoard(config, '42');
  assert.deepEqual(saved, file); assert.equal('lineCount' in saved, false);
  assert.equal(config.symbols[0].payouts[3], file.symbols[0].payouts[3]);
  assert.equal(board.runtimeBoardConfig(file, 40).lineCount, 40);
  assert.equal(board.fileFromBoard(config, '').seed, null);
});
test('blank libraries can be saved but no missing board gets a built-in fallback', () => {
  const file = {...boardFixture(),symbols:[]}; assert.equal(board.validateBoardFile(file), file);
  for (const change of [f => delete f.symbols, f => f.version = 2, f => f.seed = -1, f => f.lineCount = 20, f => f.freeSpinsAward = 8, f => f.symbols[0].id = f.symbols[1].id]) {
    const invalid = boardFixture(); change(invalid); assert.throws(() => board.validateBoardFile(invalid));
  }
});
test('board reads line count from numeric config and only saves board.json', async t => {
  const { root, store } = await fixture(t);
  const untouched = await Promise.all(['base','free','config'].map(name => fs.readFile(path.join(root,'AG1',`${name}.json`),'utf8')));
  const doc = await store.read('AG1'); assert.equal(doc.lineCount, 20);
  const changed = structuredClone(doc.file); changed.columnHeights = [2,3,4,4,3,2]; changed.symbols[0].weight = 23; changed.seed = null;
  await store.save('AG1', doc.revision, changed);
  assert.deepEqual((await store.read('AG1')).file, changed);
  assert.deepEqual(await Promise.all(['base','free','config'].map(name => fs.readFile(path.join(root,'AG1',`${name}.json`),'utf8'))), untouched);
});
test('numeric and board saves have independent revisions; updated numeric line count is reused', async t => {
  const { root, store, gameStore } = await fixture(t), doc = await store.read('AG1'), numeric = await gameStore.read('AG1');
  numeric.files.config.parameters.lineCount = 25; await gameStore.save('AG1', numeric.revision, numeric.files);
  assert.equal((await store.read('AG1')).revision, doc.revision); assert.equal((await store.read('AG1')).lineCount, 25);
  doc.file.cascadeFactors = [1,2,4]; await store.save('AG1', doc.revision, doc.file);
  assert.equal((await gameStore.read('AG1')).files.config.parameters.lineCount, 25);
  const config = JSON.parse(await fs.readFile(path.join(root,'AG1','config.json'),'utf8'));
  config.parameters.freeSpinTriggerProbability = 999;
  await fs.writeFile(path.join(root,'AG1','config.json'),JSON.stringify(config));
  assert.equal((await store.read('AG1')).lineCount,25); // Board inspection has no free-spin probability model.
});
test('stale and invalid board saves cannot overwrite external files', async t => {
  const { root, store } = await fixture(t), doc = await store.read('AG1');
  await assert.rejects(store.save('AG1', doc.revision, {...doc.file,lineCount:20}), error => error.status === 422);
  await fs.writeFile(path.join(root,'AG1','board.json'), JSON.stringify({...doc.file,seed:9}));
  await assert.rejects(store.save('AG1', doc.revision, doc.file), error => error.status === 409);
  assert.equal((await store.read('AG1')).file.seed,9);
});
test('missing board, missing line count and symlink files are rejected', async t => {
  const { root, store } = await fixture(t);
  await fs.unlink(path.join(root,'AG1','board.json')); await assert.rejects(store.read('AG1'),error => error.code === 'ENOENT');
  await fs.writeFile(path.join(root,'AG1','board.json'),JSON.stringify(boardFixture()));
  await fs.writeFile(path.join(root,'AG1','config.json'),'{}'); await assert.rejects(store.read('AG1'),/线数/);
  await fs.unlink(path.join(root,'AG1','config.json')); await fs.symlink(path.join(root,'AG1','board.json'),path.join(root,'AG1','config.json')); await assert.rejects(store.read('AG1'),/实际/);
});
test('board HTTP endpoint reads and saves independently of the numeric endpoint', async t => {
  const { root, store, gameStore } = await fixture(t);
  await fs.cp(path.join(root,'AG1'),path.join(root,'board'),{recursive:true});
  const middleware = createGameMiddleware(gameStore,store), server = createServer((req,res) => middleware(req,res,() => {res.statusCode=404;res.end();}));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/__game-files/games`;
  const doc=await (await fetch(`${base}/AG1/board`)).json(); assert.equal(doc.gameId,'AG1'); assert.equal(doc.lineCount,20);
  doc.file.seed=123;
  assert.equal((await fetch(`${base}/AG1/board`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:doc.revision,file:doc.file})})).status,200);
  assert.equal((await store.read('AG1')).file.seed,123);
  assert.equal((await (await fetch(`${base}/board`)).json()).gameId,'board');
});

test('saving only free factors persists independently without changing base factors or numeric files', async t => {
  const {root, store} = await fixture(t);
  const before = await Promise.all(['base','free','config'].map(name => fs.readFile(path.join(root,'AG1',`${name}.json`),'utf8')));
  const doc = await store.read('AG1');
  const originalBase = [...doc.file.cascadeFactors];
  doc.file.freeCascadeFactors = [3,7];
  await store.save('AG1', doc.revision, doc.file);
  const saved = await store.read('AG1');
  assert.deepEqual(saved.file.freeCascadeFactors, [3,7]);
  assert.deepEqual(saved.file.cascadeFactors, originalBase);
  const runtime = board.runtimeBoardConfig(saved.file, saved.lineCount);
  runtime.freeCascadeFactors[0] = 99;
  assert.equal(saved.file.freeCascadeFactors[0], 3);
  const after = await Promise.all(['base','free','config'].map(name => fs.readFile(path.join(root,'AG1',`${name}.json`),'utf8')));
  assert.deepEqual(after,before);
  const missing = boardFixture(); delete missing.freeCascadeFactors;
  assert.throws(() => board.validateBoardFile(missing), /免费连续消除加成/);
});

test('gold rules round trip through board files with isolated drafts and no runtime defaults', async t => {
  const { store } = await fixture(t);
  const doc = await store.read('AG1');
  doc.file.symbols.forEach((symbol,i) => {symbol.id=String(i+1);});
  doc.file.gold={columns:[2,3,4],baseProbability:.083,freeProbability:.11,wildSymbolId:doc.file.symbols.find(s=>s.role==='wild').id};
  await store.save('AG1',doc.revision,doc.file);
  const saved=await store.read('AG1');
  assert.deepEqual(saved.file.gold,doc.file.gold);
  const runtime=board.runtimeBoardConfig(saved.file,saved.lineCount);
  runtime.gold.baseProbability=.5; runtime.gold.columns.pop();
  assert.deepEqual(saved.file.gold,doc.file.gold);
  const missing=boardFixture(); delete missing.gold;
  assert.throws(()=>board.validateBoardFile(missing),/金底配置/);
});

test('free base weight and independent column increment persist in the shared board configuration',async t=>{
  const {store}=await fixture(t);const doc=await store.read('AG1');
  doc.file.scatterWeightIncrement=125;
  const scatter=doc.file.symbols.find(s=>s.role==='scatter');scatter.weight=300;
  await store.save('AG1',doc.revision,doc.file);
  const saved=await store.read('AG1');
  assert.equal(saved.file.scatterWeightIncrement,125);assert.equal(saved.file.symbols.find(s=>s.role==='scatter').weight,300);
  const runtime=board.runtimeBoardConfig(saved.file,saved.lineCount),again=board.fileFromBoard(runtime,'42');
  assert.equal(again.scatterWeightIncrement,125);assert.equal(again.symbols.find(s=>s.role==='scatter').weight,300);
});

test('unimplemented ruleType cannot use the Ways board and library pipeline', async t => {
  const {root,store} = await fixture(t);
  const file = path.join(root,'AG1','config.json');
  const config = JSON.parse(await fs.readFile(file,'utf8'));
  config.ruleType = 'paylines_v1';
  await fs.writeFile(file,JSON.stringify(config));
  await assert.rejects(store.read('AG1'), /规则.*尚未实现/);
});
