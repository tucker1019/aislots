import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { createHandler } from '../server/http.mjs';
import { createGameStore, createGameMiddleware } from '../server/game-files.mjs';
import { settings, readFixture } from './helpers/settings.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'math-http-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'dist/assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'dist/index.html'), '<script src="/math/assets/worker-hash.js"></script>');
  await fs.writeFile(path.join(root, 'dist/assets/worker-hash.js'), 'self.postMessage(1)');
  await fs.writeFile(path.join(root, 'private.json'), 'secret');
  const configRoot = path.join(root, 'configs');
  await fs.mkdir(path.join(configRoot, 'AG1'), { recursive: true });
  for (const [name, file] of Object.entries(readFixture())) await fs.writeFile(path.join(configRoot, 'AG1', `${name}.json`), JSON.stringify(file));
  const store = createGameStore(configRoot, settings.validateGameFiles);
  const middleware = createGameMiddleware(store, null, null, null, null, { allowRemote: true });
  const server = createServer(createHandler({ middleware, staticRoot: path.join(root, 'dist') }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { store, base: `http://127.0.0.1:${server.address().port}` };
}

test('math HTML, workers and file APIs are accessible without login', async t => {
  const { base } = await fixture(t);
  for (const url of ['/', '/assets/worker-hash.js', '/__game-files/games']) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('www-authenticate'), null);
  }
});

test('public API preserves edits and conflict checks, and blocks cross-site writes', async t => {
  const { base, store } = await fixture(t);
  const url = base + '/__game-files/games/AG1';
  const doc = await (await fetch(url)).json();
  doc.files.base[0][1] += 1;
  const headers = { 'Content-Type': 'application/json', Origin: base };
  const body = JSON.stringify({ revision: doc.revision, files: doc.files });
  assert.equal((await fetch(url, { method: 'PUT', headers: { ...headers, Origin: 'https://foreign.example' }, body })).status, 403);
  assert.equal((await fetch(url, { method: 'PUT', headers: { ...headers, 'Sec-Fetch-Site': 'cross-site' }, body })).status, 403);
  assert.equal((await fetch(url, { method: 'PUT', headers, body })).status, 200);
  assert.equal((await store.read('AG1')).files.base[0][1], doc.files.base[0][1]);
  assert.equal((await fetch(url, { method: 'PUT', headers, body })).status, 409);
});

test('math static serving never falls back to lobby HTML or exposes parent files', async t => {
  const { base } = await fixture(t);
  for (const url of ['/private.json', '/assets/missing.js', '/%2e%2e%2fprivate.json', '/%00']) {
    assert.equal((await fetch(base + url)).status, 404);
  }
  assert.equal((await fetch(base + '/', { method: 'PUT' })).status, 405);
  const response = await fetch(base + '/', { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
