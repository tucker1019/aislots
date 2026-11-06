import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {SecurityPage} from './SecurityPage';
import {logoutSession,changeLoginPassword} from '../services/security';
import {t} from '../i18n';
vi.mock('../services/security',()=>({logoutSession:vi.fn(),changeLoginPassword:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());
it('退出须二次确认，取消不发请求，成功后才通知清理身份',async()=>{
 const done=vi.fn();vi.mocked(logoutSession).mockResolvedValue();render(<SecurityPage onSignedOut={done}/>);
 fireEvent.click(screen.getByRole('button',{name:t('auth.logout')}));expect(logoutSession).not.toHaveBeenCalled();expect(screen.getByText(t('security.confirmText'))).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:t('security.cancel')}));expect(logoutSession).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:t('auth.logout')}));fireEvent.click(screen.getByRole('button',{name:t('security.confirmLogout')}));await waitFor(()=>expect(done).toHaveBeenCalledWith(false));expect(logoutSession).toHaveBeenCalledTimes(1);
});
it('密码确认不一致不提交',async()=>{
 render(<SecurityPage password onSignedOut={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText(t('security.oldPassword')),{target:{value:'old-password'}});fireEvent.change(screen.getByLabelText(t('security.newPassword')),{target:{value:'new-password'}});fireEvent.change(screen.getByLabelText(t('auth.confirm')),{target:{value:'different'}});fireEvent.submit(document.querySelector('form')!);
 expect(await screen.findByText(t('auth.confirmRule'))).toBeInTheDocument();expect(changeLoginPassword).not.toHaveBeenCalled();
});
it('修改密码成功要求重新登录',async()=>{
 const done=vi.fn();vi.mocked(changeLoginPassword).mockResolvedValue();render(<SecurityPage password onSignedOut={done}/>);
 fireEvent.change(screen.getByLabelText(t('security.oldPassword')),{target:{value:'old-password'}});fireEvent.change(screen.getByLabelText(t('security.newPassword')),{target:{value:'new-password'}});fireEvent.change(screen.getByLabelText(t('auth.confirm')),{target:{value:'new-password'}});fireEvent.submit(document.querySelector('form')!);await waitFor(()=>expect(done).toHaveBeenCalledWith(true));expect(changeLoginPassword).toHaveBeenCalledWith('old-password','new-password');
});
