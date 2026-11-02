import { ART_TYPES } from '../features/games/types';
import type { Game, GameArt } from '../features/games/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isArt(value: unknown): value is GameArt {
  return typeof value === 'string' && ART_TYPES.some(art => art === value);
}
/** 数据校验位于请求边界，页面和缓存只接收可信的类型。 */
export function parseCatalog(value: unknown): Game[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.games))
    throw new Error('游戏目录格式有误，请稍后重试');
  const ids = new Set<string>();
  return value.games.map((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim() ||
      typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.subtitle !== 'string' ||
      !['cascade', 'lines'].includes(String(entry.category)) || !isArt(entry.art) ||
      !['available', 'upcoming'].includes(String(entry.status)) ||
      typeof entry.featured !== 'boolean' || typeof entry.isNew !== 'boolean' ||
      typeof entry.description !== 'string' || !Array.isArray(entry.tags) ||
      !entry.tags.every((tag: unknown) => typeof tag === 'string'))
      throw new Error('游戏目录格式有误，请稍后重试');
    if (ids.has(entry.id)) throw new Error('游戏目录含有重复编号');
    ids.add(entry.id);
    return {
      id: entry.id, title: entry.title, subtitle: entry.subtitle,
      category: entry.category === 'cascade' ? 'cascade' : 'lines', art: entry.art,
      status: entry.status === 'available' ? 'available' : 'upcoming',
      featured: entry.featured, isNew: entry.isNew, description: entry.description,
      tags: entry.tags as string[],
    };
  });
}
export function resolveLaunchUrl(id: string, configuredUrl: string): string | undefined {
  if (id !== 'AG1' || !configuredUrl) return undefined;
  try {
    const url = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}
export async function fetchGames(signal?: AbortSignal): Promise<Game[]> {
  const response = await fetch(import.meta.env.VITE_CATALOG_URL || '/data/games.json', {
    signal, headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('暂时无法加载游戏，请重试');
  const value: unknown = await response.json();
  const launchUrl = import.meta.env.VITE_MAHJONG_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5180/' : '');
  return parseCatalog(value).map(game => ({
    ...game, launchUrl: game.status === 'available' ? resolveLaunchUrl(game.id, launchUrl) : undefined,
  }));
}
