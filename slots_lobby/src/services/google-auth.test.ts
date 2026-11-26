import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginWithGoogle } from './google-auth';
import { useSessionStore } from '../stores/session';

const session = { uid: 42, sid: 'g'.repeat(52), expiresAt: '2030-01-01T00:00:00Z' };

describe('Google 登录分流', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useSessionStore.setState({ session: null });
    window.history.replaceState({}, '', '/');
    delete window.AggamesBridge;
    delete window.__aggamesBridgeCallback;
  });

  it('Android App 环境通过 JSBridge 获取 idToken 并提交后端登录', async () => {
    window.history.replaceState({}, '', '/?app_name=aggame&cv=AGGAMEAPK_1.0.0');
    const postMessage = vi.fn((raw: string) => {
      const payload = JSON.parse(raw) as { id: string; action: string };
      expect(payload.action).toBe('auth.googleLogin');
      queueMicrotask(() => {
        window.__aggamesBridgeCallback?.(payload.id, {
          ok: true,
          data: { idToken: 'native-google-id-token' },
        });
      });
    });
    window.AggamesBridge = { postMessage };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 'OK', data: session }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginWithGoogle();
    expect(result).toEqual(session);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url), 'https://aggames.buzz');
    expect(parsed.pathname).toBe('/api/user/account/google/login');
    expect(parsed.searchParams.get('cv')).toBe('AGGAMEAPK_1.0.0');
    expect(JSON.parse(init.body)).toEqual({ idToken: 'native-google-id-token' });
    expect(useSessionStore.getState().session).toEqual(session);
  });
});
