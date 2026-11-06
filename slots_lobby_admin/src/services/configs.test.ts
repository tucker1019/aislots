import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishConfig, rollbackConfig, saveDraft } from './configs';
afterEach(() => vi.restoreAllMocks());
const detail = { key: 'recharge', label: '充值', published: [], draft: [], publishedVersion: 5, draftVersion: 6, history: [] };
describe('configuration CAS transport', () => {
 it('preserves monotonic draft base and separate publish/rollback preconditions', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ code: 'OK', data: detail }), { status: 200 }));
  await saveDraft('recharge', [], Math.max(5, 0), '首次草稿');
  await saveDraft('recharge', [], Math.max(5, 6), '更新草稿');
  await publishConfig('recharge', 6, '发布', 'publish-id');
  await rollbackConfig('recharge', 2, 5, '回滚', 'rollback-id');
  const bodies = fetcher.mock.calls.map(call => JSON.parse(String(call[1]?.body)) as unknown);
  expect(bodies).toEqual([
   { document: [], expectedVersion: 5, reason: '首次草稿' }, { document: [], expectedVersion: 6, reason: '更新草稿' },
   { expectedVersion: 6, reason: '发布', requestId: 'publish-id' }, { version: 2, expectedVersion: 5, reason: '回滚', requestId: 'rollback-id' },
  ]);
 });
});
