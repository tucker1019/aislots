import {beforeEach,expect,it} from 'vitest';
import {pendingInviteCode,clearInviteCode} from './invite-binding';
beforeEach(()=>{sessionStorage.clear();window.history.replaceState({},'','/');});
it('首次创建游客捕获邀请码，跨页面保留，成功后清除',()=>{
 window.history.replaceState({},'','/?inviteCode=ABC123');expect(pendingInviteCode(false)).toBe('ABC123');window.history.replaceState({},'','/my');expect(pendingInviteCode(false)).toBe('ABC123');clearInviteCode();expect(pendingInviteCode(false)).toBeUndefined();
});
it('已有身份忽略并清除邀请码，不能给已有用户重绑',()=>{
 window.history.replaceState({},'','/?inviteCode=ABC123');expect(pendingInviteCode(true)).toBeUndefined();expect(window.location.search).toBe('');expect(pendingInviteCode(false)).toBeUndefined();
});
it('无效输入不进入游客创建请求',()=>{
 window.history.replaceState({},'','/?inviteCode='+encodeURIComponent('x'.repeat(65)));expect(pendingInviteCode(false)).toBeUndefined();
});
