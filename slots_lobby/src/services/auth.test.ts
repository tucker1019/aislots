import {beforeEach,expect,it,vi} from 'vitest';
import {ensureSession,authenticateAccount} from './account';
import {useSessionStore} from '../stores/session';
import {useAuthStore} from '../stores/auth';
beforeEach(()=>{useSessionStore.setState({session:null});useAuthStore.getState().close();sessionStorage.clear();history.replaceState({},'','/');});
it('无身份时绝不自动创建游客或发起资料请求',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(ensureSession()).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();expect(useSessionStore.getState().session).toBeNull();expect(useAuthStore.getState().open).toBe(true);});
it('注册携带邀请码，成功后保存会话且清理邀请码',async()=>{history.replaceState({},'','/?inviteCode=ABC');const identity={uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'};const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({code:'OK',data:identity})});vi.stubGlobal('fetch',fetch);await authenticateAccount('register','alice','password123');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({account:'alice',password:'password123',inviteCode:'ABC'});expect(useSessionStore.getState().session).toEqual(identity);expect(location.search).toBe('');});
it('密码错误不清除待继续操作、不切换注册登录状态',async()=>{const resume=vi.fn();useAuthStore.getState().show('login',resume);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>({code:10010003})}));await expect(authenticateAccount('login','alice','incorrect')).rejects.toThrow();expect(useAuthStore.getState().resume).toBe(resume);expect(useSessionStore.getState().session).toBeNull();});
