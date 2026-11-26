import { authenticateWithGoogle } from './account';
import { callNativeBridge, shouldUseNativeBridge } from './native-bridge';
import type { Session } from '../features/account/types';

interface GoogleNativeLoginResult {
  idToken: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface GoogleGsiCredentialResponse {
  credential?: string;
}

interface GoogleGsiPromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
}

interface GoogleGsiApi {
  accounts?: {
    id?: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleGsiCredentialResponse) => void;
        cancel_on_tap_outside?: boolean;
      }) => void;
      prompt: (listener?: (notification: GoogleGsiPromptNotification) => void) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGsiApi;
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let gsiLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google login is unavailable outside browser'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (gsiLoadPromise) {
    return gsiLoadPromise;
  }
  gsiLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In SDK')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiLoadPromise = null;
      reject(new Error('Failed to load Google Sign-In SDK'));
    };
    document.head.appendChild(script);
  });
  return gsiLoadPromise;
}

async function requestWebGoogleIdToken(clientId: string): Promise<string> {
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
  }
  await loadGoogleIdentityScript();
  const gsi = window.google?.accounts?.id;
  if (!gsi) {
    throw new Error('Google Sign-In SDK unavailable');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    gsi.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response?.credential) {
          finish(() => resolve(response.credential as string));
        } else {
          finish(() => reject(new Error('Google sign-in did not return an ID token')));
        }
      },
      cancel_on_tap_outside: true,
    });

    gsi.prompt((notification) => {
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.() || notification?.isDismissedMoment?.()) {
        finish(() => reject(new Error('Google sign-in cancelled')));
      }
    });
  });
}

export async function loginWithGoogle(): Promise<Session> {
  const webClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  let idToken: string;

  if (shouldUseNativeBridge()) {
    const result = await callNativeBridge<GoogleNativeLoginResult>('auth.googleLogin', {
      ...(webClientId ? { clientId: webClientId } : {}),
    });
    if (!result?.idToken) {
      throw new Error('Google sign-in did not return an ID token');
    }
    idToken = result.idToken;
  } else {
    idToken = await requestWebGoogleIdToken(webClientId);
  }

  return authenticateWithGoogle(idToken);
}
