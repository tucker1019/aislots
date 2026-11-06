import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCustomAccount,updateAccountAvatar,loadAccountProfile } from './account';
import { useSessionStore } from '../stores/session';

const session = { uid: 7, sid: 's'.repeat(52), expiresAt: '2030-01-01T00:00:00Z' };
const profile = { account:'',uid: 7, nickname: 'player_7', avatarId: 3, coins: 123456 };
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ code: 'OK', data }) });
beforeEach(() => { localStorage.clear(); useSessionStore.setState({ session: null }); });

describe('大廳身份與資料', () => {
  it('已有身份併發讀取資料只續期一次', async () => {
    useSessionStore.setState({session});
    const request = vi.fn().mockResolvedValueOnce(ok(session)).mockResolvedValue(ok(profile));
    vi.stubGlobal('fetch', request);
    const result = await Promise.all([loadAccountProfile(), loadAccountProfile()]);
    expect(result).toEqual([profile, profile]);
    expect(request.mock.calls.filter(([url]) => String(url).endsWith('/session/renewal'))).toHaveLength(1);
    expect(useSessionStore.getState().session).toEqual(session);
    const saved = localStorage.getItem('aislots-lobby-session');
    expect(saved).toContain(session.sid);
    expect(saved).not.toContain('coins');
  });
  it('有身份先續期；會話失效清除身份且不創建其他遊客', async () => {
    useSessionStore.setState({ session: { ...session, sid: 'x'.repeat(52) } });
    const request = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: 10010002 }) });
    vi.stubGlobal('fetch', request);
    await expect(loadAccountProfile()).rejects.toThrow(/會話/);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/api/user/account/session/renewal');
    expect(useSessionStore.getState().session).toBeNull();
  });
  it('續期成功後資料匹配當前用戶；拒絕錯誤金額與頭像', async () => {
    useSessionStore.setState({ session: { ...session, sid: 'y'.repeat(52) } });
    const request = vi.fn().mockResolvedValueOnce(ok(session)).mockResolvedValueOnce(ok(profile));
    vi.stubGlobal('fetch', request);
    expect(await loadAccountProfile()).toEqual(profile);
    for (const invalid of [{ ...profile, uid: 8 }, { ...profile, coins: '123' },
      { ...profile, coins: Number.MAX_SAFE_INTEGER + 1 }, { ...profile, avatarId: 16 }]) {
      request.mockResolvedValueOnce(ok(invalid));
      await expect(loadAccountProfile()).rejects.toThrow(/資料/);
    }
  });
  it('網絡失敗可重新請求，不把異常顯示為0餘額', async () => {
    useSessionStore.setState({session:{...session,sid:'n'.repeat(52)}});
    const request = vi.fn().mockRejectedValueOnce(new TypeError('failed')).mockResolvedValueOnce(ok(session)).mockResolvedValueOnce(ok(profile));
    vi.stubGlobal('fetch', request);
    await expect(loadAccountProfile()).rejects.toThrow(/連接/);
    expect(await loadAccountProfile()).toEqual(profile);
  });
});

it('綁定通過現有接口保留當前UID，密碼不會持久化',async()=>{
 const current={...session,sid:'b'.repeat(52)};useSessionStore.setState({session:current});const send=vi.fn().mockResolvedValueOnce(ok(current)).mockResolvedValueOnce(ok(current));vi.stubGlobal('fetch',send);
 await bindCustomAccount('custom_user','test_password_123');const [url,init]=send.mock.calls[1];expect(url).toBe('/api/user/account/uniquecode/bind');expect(JSON.parse(init.body)).toEqual({uid:7,sid:current.sid,account:'custom_user',password:'test_password_123'});expect(localStorage.getItem('aislots-lobby-session')).not.toContain('test_password_123');expect(useSessionStore.getState().session?.uid).toBe(7);
});
it('頭像更新只提交頭像ID並拒絕其他用戶的資料響應',async()=>{
 const current={...session,sid:'a'.repeat(52)};useSessionStore.setState({session:current});const send=vi.fn().mockResolvedValueOnce(ok(current)).mockResolvedValueOnce(ok({...profile,uid:8}));vi.stubGlobal('fetch',send);
 await expect(updateAccountAvatar(8)).rejects.toThrow();expect(JSON.parse(send.mock.calls[1][1].body)).toEqual({uid:7,sid:current.sid,avatarId:8});
});
