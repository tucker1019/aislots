import {beforeEach,expect,it} from 'vitest';
import {pendingInviteCode,clearInviteCode} from './invite-binding';
beforeEach(()=>{sessionStorage.clear();window.history.replaceState({},'','/');});
it('首次創建遊客捕獲邀請碼，跨頁面保留，成功後清除',()=>{
 window.history.replaceState({},'','/?inviteCode=ABC123');expect(pendingInviteCode(false)).toBe('ABC123');window.history.replaceState({},'','/my');expect(pendingInviteCode(false)).toBe('ABC123');clearInviteCode();expect(pendingInviteCode(false)).toBeUndefined();
});
it('已有身份忽略並清除邀請碼，不能給已有用戶重綁',()=>{
 window.history.replaceState({},'','/?inviteCode=ABC123');expect(pendingInviteCode(true)).toBeUndefined();expect(window.location.search).toBe('');expect(pendingInviteCode(false)).toBeUndefined();
});
it('無效輸入不進入遊客創建請求',()=>{
 window.history.replaceState({},'','/?inviteCode='+encodeURIComponent('x'.repeat(65)));expect(pendingInviteCode(false)).toBeUndefined();
});
