import { expect, it, vi } from 'vitest';
import { resolveGameEntry } from './game-entry';
it('入口地址校验拒绝危险协议、内嵌身份及缺失生产地址', () => {
  expect(resolveGameEntry('', true)).toBe('http://127.0.0.1:5180/');
  expect(resolveGameEntry('', false)).toBeUndefined();
  expect(resolveGameEntry('https://game.example/AG1/', false)).toBe('https://game.example/AG1/');
  expect(resolveGameEntry('javascript:alert(1)', false)).toBeUndefined();
  expect(resolveGameEntry('https://user:password@game.example/', false)).toBeUndefined();
});

it('从大厅身份申请临时入口，拒绝缺少票据的返回地址', async () => {
  vi.resetModules();
  vi.doMock('./account', () => ({
    ensureSession: vi.fn().mockResolvedValue({ uid: 7, sid: 'session' }),
    request: vi.fn().mockResolvedValue({ launchUrl: 'https://game.example/AG1/?launchTicket=' + 'T'.repeat(52), expiresAt: new Date(Date.now() + 60000).toISOString() }),
  }));
  const { launchGame } = await import('./game-entry');
  const { request } = await import('./account');
  expect(await launchGame('AG1')).toContain('launchTicket=');
  expect(request).toHaveBeenCalledWith('/api/game/launch', { method: 'POST', body: JSON.stringify({ uid: 7, sid: 'session', gameId: 'AG1' }) }, '暂时无法进入游戏，请重试');
  vi.mocked(request).mockResolvedValue({ launchUrl: 'https://game.example/AG1/', expiresAt: new Date(Date.now() + 60000).toISOString() });
  await expect(launchGame('AG1')).rejects.toThrow(/入口无效/);
  vi.doUnmock('./account');
});
