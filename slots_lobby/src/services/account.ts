import {useAuthStore} from '../stores/auth';
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
    const body: unknown = await response.json().catch(() => { throw new Error(t('copy.invalidLobbyResponsePleaseRetry')); });
    if (response.status === 401 && ((isRecord(body)&&body.code===10010003)||/\/uniquecode\/(login|register)$/.test(path))) throw new Error(failureMessage);
    if (response.status === 401) { useSessionStore.getState().clearSession(); useAuthStore.getState().show(); throw new Error(t('copy.sessionExpiredPleaseSignInAgain')); }
    if (isRecord(body) && body.code === 10010002) { useSessionStore.getState().clearSession(); useAuthStore.getState().show(); throw new Error(t('copy.sessionExpiredPleaseSignInAgain')); }
    if (!response.ok || !isRecord(body) || body.code !== 'OK')
      throw new Error(failureMessage, { cause: body });
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
  if (!stored) { useAuthStore.getState().show(); return Promise.reject(new Error(t('auth.required'))); }
  if (stored && confirmed?.sid === stored.sid && confirmed.uid === stored.uid && Date.parse(confirmed.expiresAt) > Date.now())
    return Promise.resolve(confirmed);
  // 续期不绑定组件的取消信号，StrictMode 重挂载时共用同一次续期。
  if (pending) return pending;
  pending = (async () => {
    const data = await request('/api/user/account/session/renewal', {
      method: 'POST', body: JSON.stringify({uid:stored.uid,sid:stored.sid}),
    });
    if (!isSession(data) || (stored && data.uid !== stored.uid)) throw new Error(t('copy.invalidSignInResponsePleaseRetry'));
    const current = useSessionStore.getState().session;
    if (current?.sid !== stored?.sid || current?.uid !== stored?.uid) throw new Error(t('copy.signInStateChangedPleaseRetry'));
    useSessionStore.getState().setSession(data);
    confirmed = data;
    return data;
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function loadAccountProfile(signal?: AbortSignal): Promise<UserProfile> {
  const identity = await ensureSession();
  const params = new URLSearchParams({ uid: String(identity.uid), sid: identity.sid });
  const data = await request('/api/user/user/info?' + params.toString(), { signal });
  return parseProfile(data,identity.uid);
}

function parseProfile(data:unknown,uid:number):UserProfile {
  if (!isRecord(data) || data.uid !== uid || (data.account!==undefined&&typeof data.account!=='string') || typeof data.nickname !== 'string' || (data.account!==undefined&&typeof data.account!=='string') ||
    !Number.isInteger(data.avatarId) || Number(data.avatarId) < 1 || Number(data.avatarId) > 15 ||
    !Number.isSafeInteger(data.coins) || Number(data.coins) < 0)
    throw new Error(t('copy.invalidUserProfilePleaseRetry'));
  return { account:typeof data.account==='string'?data.account:'',uid:uid, nickname: data.nickname, avatarId: Number(data.avatarId), coins: Number(data.coins) };
}

function requireCurrent(identity:Session){const current=useSessionStore.getState().session;if(current?.uid!==identity.uid||current.sid!==identity.sid)throw new Error(t('copy.signInStateChangedPleaseRetry'));}
export async function updateAccountAvatar(avatarId:number){
 const identity=await ensureSession();requireCurrent(identity);
 const data=await request('/api/user/user/update',{method:'POST',body:JSON.stringify({uid:identity.uid,sid:identity.sid,avatarId})});
 requireCurrent(identity);return parseProfile(data,identity.uid);
}
export async function bindCustomAccount(account:string,password:string){
 const identity=await ensureSession();requireCurrent(identity);
 const data=await request('/api/user/account/uniquecode/bind',{method:'POST',body:JSON.stringify({uid:identity.uid,sid:identity.sid,account,password})});
 requireCurrent(identity);if(!isSession(data)||data.uid!==identity.uid)throw new Error(t('copy.invalidUserProfilePleaseRetry'));
 confirmed=data;useSessionStore.getState().setSession(data);return data;
}

export async function authenticateAccount(mode:'login'|'register',account:string,password:string){
 const inviteCode=mode==='register'?pendingInviteCode(false):undefined;
 const data=await request('/api/user/account/uniquecode/'+mode,{method:'POST',body:JSON.stringify({account,password,...(inviteCode?{inviteCode}:{})})},t('auth.failed'));
 if(!isSession(data))throw new Error(t('copy.invalidSignInResponsePleaseRetry'));
 confirmed=data;useSessionStore.getState().setSession(data);clearInviteCode();return data;
}
