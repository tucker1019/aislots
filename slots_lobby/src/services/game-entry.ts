import { t } from '../i18n';
import { ensureSession, request } from './account';
import { isRecord } from '../features/account/types';
/** 校验HTTP(S)游戏入口；实际进入地址由大厅服务签发。 */
export function resolveGameEntry(configured: string, development: boolean): string | undefined {
  const value = configured || (development ? 'http://127.0.0.1:5180/' : '');
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}

/** 地址由大厅服务配置；浏览器不传入游戏地址或余额。 */
export async function launchGame(gameId: string): Promise<string> {
  const identity = await ensureSession();
  const data = await request('/api/game/launch', { method: 'POST',
    body: JSON.stringify({ uid: identity.uid, sid: identity.sid, gameId }),
  }, t('copy.unableToOpenTheGamePleaseRetry'));
  if (!isRecord(data) || typeof data.launchUrl !== 'string' || typeof data.expiresAt !== 'string')
    throw new Error(t('copy.invalidGameLaunchResponse'));
  const url = resolveGameEntry(data.launchUrl, false);
  if (!url || new URL(url).searchParams.get('launchTicket')?.length !== 52 || !Number.isFinite(Date.parse(data.expiresAt)))
    throw new Error(t('copy.gameEntryIsInvalidOrExpiredPlease'));
  return url;
}


// Version the per-tab entry cache so an entry issued before a game's launch
// address was corrected (for example AG9 pointing at the AG4 port) cannot be
// reused after a local catalog/config change.
const embeddedEntryKey = (gameId: string) => 'aislots-embedded-v2-' + gameId;
/** 仅在当前标签页保存服务端签发的入口，父页面刷新时恢复同一iframe。 */
export function rememberGameEntry(url: string, gameId = 'AG1', expiresAt?: string) {
  const expires = expiresAt && Number.isFinite(Date.parse(expiresAt))
    ? Date.parse(expiresAt)
    : Date.now() + 4 * 60 * 1000;
  sessionStorage.setItem(embeddedEntryKey(gameId), JSON.stringify({ url, expiresAt: expires }));
}
export function readGameEntry(gameId = 'AG1'): string | undefined {
  const stored = sessionStorage.getItem(embeddedEntryKey(gameId));
  if (!stored) return undefined;
  try {
    const value = JSON.parse(stored);
    if (typeof value?.url !== 'string' || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
      sessionStorage.removeItem(embeddedEntryKey(gameId));
      return undefined;
    }
    return resolveGameEntry(value.url, false);
  } catch {
    // Drop entries written by the old version: they had no expiry and could
    // keep an expired launch ticket alive forever.
    sessionStorage.removeItem(embeddedEntryKey(gameId));
    return undefined;
  }
}
export function forgetGameEntry(gameId = 'AG1') { sessionStorage.removeItem(embeddedEntryKey(gameId)); }
