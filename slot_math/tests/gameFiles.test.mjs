import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { createGameStore, createGameMiddleware } from '../server/game-files.mjs';
import { settings, readFixture } from './helpers/settings.mjs';
async function fixture(t, overrides) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'slot-game-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'AG1'));
  const files = readFixture();
  for (const name of ['base', 'free', 'config']) await fs.writeFile(path.join(root, 'AG1', `${name}.json`), JSON.stringify(files[name], null, 2) + '\n');
  return { root, store: createGameStore(root, settings.validateGameFiles, overrides ? { ...fs, ...overrides } : fs) };
}
test('lists game directories and reads exactly their three JSON files', async t => {
  const { root, store } = await fixture(t);
  await fs.writeFile(path.join(root, 'README.md'), 'ignored');
  assert.deepEqual(await store.list(), ['AG1']);
  const doc = await store.read('AG1'); assert.equal(doc.revision.length, 64); assert.deepEqual(doc.files, readFixture());
});
test('saves all three files, survives a new store instance and detects stale editors', async t => {
  const { root, store } = await fixture(t), doc = await store.read('AG1');
  const files = structuredClone(doc.files);
  files.base[0][1] += 1; files.free[0][1] += 2; files.config.parameters.lineCount = 25; files.config.ruleType = 'paylines_v1';
  const saved = await store.save('AG1', doc.revision, files);
  assert.notEqual(saved.revision, doc.revision);
  assert.deepEqual((await createGameStore(root, settings.validateGameFiles).read('AG1')).files, files);
  await assert.rejects(store.save('AG1', doc.revision, doc.files), error => error.status === 409);
  assert.deepEqual((await store.read('AG1')).files, files);
});
test('invalid save changes no file, and external edits are not overwritten', async t => {
  const { root, store } = await fixture(t), doc = await store.read('AG1');
  const invalid = structuredClone(doc.files); invalid.free = [[5, -1]];
  await assert.rejects(store.save('AG1', doc.revision, invalid), error => error.status === 422);
  assert.equal((await store.read('AG1')).revision, doc.revision);
  const changed = structuredClone(doc.files.config); changed.simulationOptions.seed = 123;
  await fs.writeFile(path.join(root, 'AG1', 'config.json'), JSON.stringify(changed));
  await assert.rejects(store.save('AG1', doc.revision, doc.files), error => error.status === 409);
  assert.equal((await store.read('AG1')).files.config.simulationOptions.seed, 123);
});
test('failure replacing the second file rolls back the first and cleans temporary files', async t => {
  let count = 0;
  const { root, store } = await fixture(t, { async rename(from, to) { if (++count === 2) throw new Error('simulated disk failure'); return fs.rename(from, to); } });
  const doc = await store.read('AG1'), changed = structuredClone(doc.files);
  changed.base[0][1] += 1; changed.free[0][1] += 1;
  await assert.rejects(store.save('AG1', doc.revision, changed), /simulated disk failure/);
  assert.equal((await store.read('AG1')).revision, doc.revision);
  assert.deepEqual((await fs.readdir(path.join(root, 'AG1'))).sort(), ['base.json', 'config.json', 'free.json']);
});
test('simultaneous saves of one revision allow only one writer', async t => {
  const { store } = await fixture(t), doc = await store.read('AG1');
  const a = structuredClone(doc.files), b = structuredClone(doc.files);
  a.config.simulationOptions.seed = 12; b.config.simulationOptions.seed = 13;
  const result = await Promise.allSettled([store.save('AG1', doc.revision, a), store.save('AG1', doc.revision, b)]);
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(result.find(item => item.status === 'rejected').reason.status, 409);
});
test('rejects path traversal, symlink directories and symlink files', async t => {
  const { root, store } = await fixture(t);
  for (const id of ['../AG1', '/tmp', 'AG1/config.json', '']) await assert.rejects(store.read(id));
  await fs.symlink(path.join(root, 'AG1'), path.join(root, 'LINK'));
  assert.deepEqual(await store.list(), ['AG1']); await assert.rejects(store.read('LINK'));
  await fs.rename(path.join(root, 'AG1', 'free.json'), path.join(root, 'original.json'));
  await fs.symlink(path.join(root, 'original.json'), path.join(root, 'AG1', 'free.json'));
  await assert.rejects(store.read('AG1'));
});
test('missing or malformed files cause errors without a default fallback', async t => {
  const { root, store } = await fixture(t);
  await fs.writeFile(path.join(root, 'AG1', 'base.json'), '{broken');
  await assert.rejects(store.read('AG1'), /base.json/);
  await fs.unlink(path.join(root, 'AG1', 'base.json'));
  await assert.rejects(store.read('AG1'), error => error.code === 'ENOENT');
});
test('HTTP endpoint reads and saves files, rejects foreign origins and unsafe requests', async t => {
  const { store } = await fixture(t), middleware = createGameMiddleware(store);
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`, url = `${base}/__game-files/games`;
  assert.deepEqual(await (await fetch(url)).json(), { games: ['AG1'] });
  const doc = await (await fetch(`${url}/AG1`)).json();
  doc.files.config.simulationOptions.paidSpins = 1000;
  const save = await fetch(`${url}/AG1`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ revision: doc.revision, files: doc.files }) });
  assert.equal(save.status, 200);
  assert.equal((await store.read('AG1')).files.config.simulationOptions.paidSpins, 1000);
  assert.equal((await fetch(`${url}/AG1`, { headers: { Origin: 'https://foreign.example' } })).status, 403);
  assert.equal((await fetch(`${url}/AG1`, { headers: { Origin: 'null' } })).status, 403);
  assert.equal((await fetch(`${url}/AG1`, { method: 'PUT', body: '{}' })).status, 415);
  assert.equal((await fetch(`${url}/AG1`, { method: 'DELETE' })).status, 405);
  assert.equal((await fetch(`${url}/AG1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
});
