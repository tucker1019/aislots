import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCustomAccount,updateAccountAvatar,loadAccountProfile } from './account';
import { useSessionStore } from '../stores/session';

const session = { uid: 7, sid: 's'.repeat(52), expiresAt: '2030-01-01T00:00:00Z' };
const profile = { account:'',uid: 7, nickname: 'player_7', avatarId: 3, coins: 123456 };
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ code: 'OK', data }) });
beforeEach(() => { localStorage.clear(); useSessionStore.setState({ session: null }); });

describe('大厅身份与资料', () => {
  it('首次创建游客并读取真实资料，并发请求共用一次登录', async () => {
    const request = vi.fn().mockResolvedValueOnce(ok(session)).mockResolvedValue(ok(profile));
    vi.stubGlobal('fetch', request);
    const result = await Promise.all([loadAccountProfile(), loadAccountProfile()]);
    expect(result).toEqual([profile, profile]);
    expect(request.mock.calls.filter(([url]) => String(url).endsWith('/visitor/login'))).toHaveLength(1);
    expect(useSessionStore.getState().session).toEqual(session);
    const saved = localStorage.getItem('aislots-lobby-session');
    expect(saved).toContain(session.sid);
    expect(saved).not.toContain('coins');
  });
  it('有身份先续期；会话失效保留原身份且不创建其他游客', async () => {
    useSessionStore.setState({ session: { ...session, sid: 'x'.repeat(52) } });
    const request = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: 10010002 }) });
    vi.stubGlobal('fetch', request);
    await expect(loadAccountProfile()).rejects.toThrow(/会话/);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/api/user/account/session/renewal');
    expect(useSessionStore.getState().session?.uid).toBe(7);
  });
  it('续期成功后资料匹配当前用户；拒绝错误金额与头像', async () => {
    useSessionStore.setState({ session: { ...session, sid: 'y'.repeat(52) } });
    const request = vi.fn().mockResolvedValueOnce(ok(session)).mockResolvedValueOnce(ok(profile));
    vi.stubGlobal('fetch', request);
    expect(await loadAccountProfile()).toEqual(profile);
    for (const invalid of [{ ...profile, uid: 8 }, { ...profile, coins: '123' },
      { ...profile, coins: Number.MAX_SAFE_INTEGER + 1 }, { ...profile, avatarId: 16 }]) {
      request.mockResolvedValueOnce(ok(invalid));
      await expect(loadAccountProfile()).rejects.toThrow(/资料/);
    }
  });
  it('网络失败可重新请求，不把异常显示为0余额', async () => {
    const request = vi.fn().mockRejectedValueOnce(new TypeError('failed')).mockResolvedValueOnce(ok(session)).mockResolvedValueOnce(ok(profile));
    vi.stubGlobal('fetch', request);
    await expect(loadAccountProfile()).rejects.toThrow(/连接/);
    expect(await loadAccountProfile()).toEqual(profile);
  });
});

it('绑定通过现有接口保留当前UID，密码不会持久化',async()=>{
 const current={...session,sid:'b'.repeat(52)};useSessionStore.setState({session:current});const send=vi.fn().mockResolvedValueOnce(ok(current)).mockResolvedValueOnce(ok(current));vi.stubGlobal('fetch',send);
 await bindCustomAccount('custom_user','test_password_123');const [url,init]=send.mock.calls[1];expect(url).toBe('/api/user/account/uniquecode/bind');expect(JSON.parse(init.body)).toEqual({uid:7,sid:current.sid,account:'custom_user',password:'test_password_123'});expect(localStorage.getItem('aislots-lobby-session')).not.toContain('test_password_123');expect(useSessionStore.getState().session?.uid).toBe(7);
});
it('头像更新只提交头像ID并拒绝其他用户的资料响应',async()=>{
 const current={...session,sid:'a'.repeat(52)};useSessionStore.setState({session:current});const send=vi.fn().mockResolvedValueOnce(ok(current)).mockResolvedValueOnce(ok({...profile,uid:8}));vi.stubGlobal('fetch',send);
 await expect(updateAccountAvatar(8)).rejects.toThrow();expect(JSON.parse(send.mock.calls[1][1].body)).toEqual({uid:7,sid:current.sid,avatarId:8});
});
