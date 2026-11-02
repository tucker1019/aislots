import { describe, expect, it, vi } from 'vitest';
import { fetchGames, parseCatalog, resolveLaunchUrl } from './catalog';
const game = { id: 'AG1', title: '麻将胡了', subtitle: 'Mahjong Ways', category: 'cascade', art: 'mahjong', status: 'available', featured: true, isNew: false, description: '麻将游戏', tags: ['麻将'] };
describe('游戏目录边界', () => {
  it('验证目录，不把错误数据静默当作空列表', () => {
    expect(parseCatalog({ version: 1, games: [game] })).toHaveLength(1);
    expect(parseCatalog({ version: 1, games: [] })).toEqual([]);
    expect(() => parseCatalog({ games: 'wrong' })).toThrow();
    expect(() => parseCatalog({ version: 1, games: [game, game] })).toThrow(/重复/);
    expect(() => parseCatalog({ version: 1, games: [{ ...game, category: 'bad' }] })).toThrow();
  });
  it('不允许危险协议、嵌入密码或未配置的游戏入口', () => {
    expect(resolveLaunchUrl('AG1', 'https://game.example/AG1/')).toBe('https://game.example/AG1/');
    expect(resolveLaunchUrl('AG1', 'javascript:alert(1)')).toBeUndefined();
    expect(resolveLaunchUrl('AG1', 'https://user:secret@game.example/')).toBeUndefined();
    expect(resolveLaunchUrl('preview-candy', 'https://game.example/')).toBeUndefined();
    expect(resolveLaunchUrl('AG1', '')).toBeUndefined();
  });
  it('HTTP失败提供可重试错误；取消请求传递 AbortSignal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchGames()).rejects.toThrow(/加载/);
    const signal = new AbortController().signal;
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, games: [game] }) });
    vi.stubGlobal('fetch', request);
    await fetchGames(signal);
    expect(request).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal }));
  });
});
