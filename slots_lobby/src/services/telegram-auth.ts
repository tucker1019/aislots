import { authenticateWithTelegram, authenticateWithTelegramOidc, type TelegramAuthData } from './account';
import { callNativeBridge, shouldUseNativeBridge } from './native-bridge';
import type { Session } from '../features/account/types';

interface TelegramWidgetApi {
  Login?: {
    auth: (
      options: { bot_id: string; request_access?: boolean; lang?: string },
      callback: (data: TelegramAuthData | false) => void,
    ) => void;
  };
}

declare global {
  interface Window {
    Telegram?: TelegramWidgetApi;
  }
}

const TG_WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';
const TG_OIDC_AUTH_URL = 'https://oauth.telegram.org/auth';
const TG_OIDC_STATE_KEY = 'aggame_tg_oidc_state';
const TG_OIDC_VERIFIER_KEY = 'aggame_tg_oidc_verifier';
let tgLoadPromise: Promise<void> | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

async function startTelegramOidcRedirect(clientId: string): Promise<never> {
  const state = randomBase64Url(24);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  localStorage.setItem(TG_OIDC_STATE_KEY, state);
  localStorage.setItem(TG_OIDC_VERIFIER_KEY, codeVerifier);

  const redirectUri = `${window.location.origin}/auth/telegram/callback`;
  const authUrl = new URL(TG_OIDC_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(authUrl.toString());
  return new Promise<never>(() => {});
}

function loadTelegramWidgetScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Telegram login is unavailable outside browser'));
  }
  if (window.Telegram?.Login?.auth) {
    return Promise.resolve();
  }
  if (tgLoadPromise) {
    return tgLoadPromise;
  }
  tgLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TG_WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Telegram Login SDK')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TG_WIDGET_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      tgLoadPromise = null;
      reject(new Error('Failed to load Telegram Login SDK'));
    };
    document.head.appendChild(script);
  });
  return tgLoadPromise;
}

async function requestWebTelegramAuth(botId: string): Promise<TelegramAuthData> {
  if (!botId) {
    throw new Error('VITE_TELEGRAM_BOT_ID is not configured');
  }
  await loadTelegramWidgetScript();
  const tgAuth = window.Telegram?.Login?.auth;
  if (!tgAuth) {
    throw new Error('Telegram Login SDK unavailable');
  }

  return new Promise<TelegramAuthData>((resolve, reject) => {
    tgAuth({ bot_id: botId, request_access: true }, (data) => {
      if (!data || !data.id || !data.hash) {
        reject(new Error('Telegram sign-in cancelled'));
        return;
      }
      resolve(data);
    });
  });
}

interface TelegramNativeOidcResult {
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  id?: number;
  hash?: string;
}

export async function loginWithTelegram(): Promise<Session> {
  const oidcClientId = (import.meta.env.VITE_TELEGRAM_CLIENT_ID || '').trim();
  const botId = (import.meta.env.VITE_TELEGRAM_BOT_ID || '').trim();

  if (shouldUseNativeBridge()) {
    const nativeResult = await callNativeBridge<TelegramNativeOidcResult>('auth.telegramLogin', {
      ...(oidcClientId || botId ? { botId: oidcClientId || botId } : {}),
    });
    if (nativeResult?.code && nativeResult?.redirectUri) {
      return authenticateWithTelegramOidc(
        nativeResult.code,
        nativeResult.redirectUri,
        nativeResult.codeVerifier || '',
      );
    }
    if (nativeResult?.id && nativeResult?.hash) {
      return authenticateWithTelegram(nativeResult as TelegramAuthData);
    }
    throw new Error('Telegram sign-in did not return valid auth data');
  }

  // Prefer modern Telegram OIDC (Authorization Code + PKCE) when OIDC client_id is configured
  if (oidcClientId) {
    return startTelegramOidcRedirect(oidcClientId);
  }

  const authData = await requestWebTelegramAuth(botId);
  return authenticateWithTelegram(authData);
}

export async function consumeTelegramOidcCallbackIfPresent(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname !== '/auth/telegram/callback') return false;

  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim();
  const state = (params.get('state') || '').trim();
  const expectedState = localStorage.getItem(TG_OIDC_STATE_KEY) || '';
  const codeVerifier = localStorage.getItem(TG_OIDC_VERIFIER_KEY) || '';

  localStorage.removeItem(TG_OIDC_STATE_KEY);
  localStorage.removeItem(TG_OIDC_VERIFIER_KEY);

  const redirectUri = `${window.location.origin}/auth/telegram/callback`;
  window.history.replaceState({}, '', '/');

  if (!code) {
    return false;
  }
  if (expectedState && state && state !== expectedState) {
    return false;
  }

  try {
    await authenticateWithTelegramOidc(code, redirectUri, codeVerifier);
    return true;
  } catch {
    return false;
  }
}
