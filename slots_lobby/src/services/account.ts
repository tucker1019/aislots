import { pendingInviteCode, clearInviteCode } from './invite-binding';
import { t, getLocale } from '../i18n';
import { isRecord, isSession } from '../features/account/types';
import type { Session, UserProfile } from '../features/account/types';
import { useSessionStore } from '../stores/session';

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_LOBBY_API_URL;
  if (!base) return path;
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error(t('copy.invalidLobbyApiUrlConfiguration'));
  return base.replace(/\/$/, '') + path;
}

export async function request(path: string, init: RequestInit = {}, failureMessage = t('copy.unableToReadYourProfilePleaseRetry')): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const signal = init.signal;
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetch(apiUrl(path), { ...init, signal: controller.signal,
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', 'Accept-Language':getLocale(), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (response.status === 401) throw new Error(t('copy.sessionExpiredPleaseSignInAgain'));
    const body: unknown = await response.json().catch(() => { throw new Error(t('copy.invalidLobbyResponsePleaseRetry')); });
    if (isRecord(body) && body.code === 10010002)
      throw new Error(t('copy.sessionExpiredPleaseSignInAgain'));
    if (!response.ok || !isRecord(body) || body.code !== 'OK')
      throw new Error(failureMessage);
    return body.data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof TypeError || controller.signal.aborted)
      throw new Error(t('copy.unableToConnectToTheLobbyPlease'), { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

let confirmed: Session | null = null;
let pending: Promise<Session> | undefined;
export function ensureSession(): Promise<Session> {
  const stored = useSessionStore.getState().session;
  const inviteCode=pendingInviteCode(Boolean(stored));
  if (stored && confirmed?.sid === stored.sid && confirmed.uid === stored.uid && Date.parse(confirmed.expiresAt) > Date.now())
    return Promise.resolve(confirmed);
  // 登录不绑定组件的取消信号，避免 StrictMode 重挂载重复创建游客。
  if (pending) return pending;
  pending = (async () => {
    const data = await request('/api/user/account/' + (stored ? 'session/renewal' : 'visitor/login'), {
      method: 'POST', body: JSON.stringify(stored ? { uid: stored.uid, sid: stored.sid } : inviteCode ? {inviteCode} : {}),
    });
    if (!isSession(data) || (stored && data.uid !== stored.uid)) throw new Error(t('copy.invalidSignInResponsePleaseRetry'));
    const current = useSessionStore.getState().session;
    if (current?.sid !== stored?.sid || current?.uid !== stored?.uid) throw new Error(t('copy.signInStateChangedPleaseRetry'));
    useSessionStore.getState().setSession(data);
    clearInviteCode();
    confirmed = data;
    return data;
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function loadAccountProfile(signal?: AbortSignal): Promise<UserProfile> {
  const identity = await ensureSession();
  const params = new URLSearchParams({ uid: String(identity.uid), sid: identity.sid });
  const data = await request('/api/user/user/info?' + params.toString(), { signal });
  if (!isRecord(data) || data.uid !== identity.uid || typeof data.nickname !== 'string' ||
    !Number.isInteger(data.avatarId) || Number(data.avatarId) < 1 || Number(data.avatarId) > 15 ||
    !Number.isSafeInteger(data.coins) || Number(data.coins) < 0)
    throw new Error(t('copy.invalidUserProfilePleaseRetry'));
  return { uid: identity.uid, nickname: data.nickname, avatarId: Number(data.avatarId), coins: Number(data.coins) };
}
