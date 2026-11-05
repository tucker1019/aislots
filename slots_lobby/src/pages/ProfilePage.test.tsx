import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ProfilePage} from './ProfilePage';
import {UserSummary} from '../features/account/UserSummary';
import {useSessionStore} from '../stores/session';
import {loadAccountProfile,updateAccountAvatar,bindCustomAccount} from '../services/account';
import type * as Account from '../services/account';
vi.mock('../services/account',async original=>({...await original<typeof Account>(),loadAccountProfile:vi.fn(),updateAccountAvatar:vi.fn(),bindCustomAccount:vi.fn()}));
const profile={uid:7,nickname:'player_7',account:'',coins:10000,avatarId:3};
const identity={uid:7,sid:'s'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'};
beforeEach(()=>{vi.mocked(loadAccountProfile).mockReset().mockResolvedValue(profile);vi.mocked(updateAccountAvatar).mockReset();vi.mocked(bindCustomAccount).mockReset();useSessionStore.setState({session:identity});});
function setup(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><ProfilePage onBack={vi.fn()}/><UserSummary/></QueryClientProvider>);}
it('個人資料僅展示會員ID、賬號及綁定入口，選擇平台頭像後同步頂欄',async()=>{
 setup();await screen.findByText('遊客賬號');expect(screen.queryByText('會員姓名')).not.toBeInTheDocument();expect(screen.queryByText('手機號')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'更換頭像'}));expect(screen.getAllByRole('button',{name:/^頭像 \d+$/})).toHaveLength(15);
 vi.mocked(updateAccountAvatar).mockImplementation(async()=>{const next={...profile,avatarId:8};vi.mocked(loadAccountProfile).mockResolvedValue(next);return next;});
 fireEvent.click(screen.getByRole('button',{name:'頭像 8'}));fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(screen.getByRole('img',{name:'當前頭像'})).toHaveAttribute('src','/assets/profile/avatar/8.png'));expect(screen.getByRole('img',{name:'player_7的頭像'})).toHaveAttribute('src','/assets/profile/avatar/8.png');expect(updateAccountAvatar).toHaveBeenCalledWith(8);
});
it('綁定賬號同時更新暱稱和綁定狀態，不再提供綁定按鈕',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'綁定自定義賬號'}));
 fireEvent.change(screen.getByLabelText('會員賬號'),{target:{value:'custom_user'}});fireEvent.change(screen.getByLabelText('設置密碼'),{target:{value:'password_123'}});fireEvent.change(screen.getByLabelText('確認密碼'),{target:{value:'password_123'}});
 vi.mocked(bindCustomAccount).mockImplementation(async()=>{vi.mocked(loadAccountProfile).mockResolvedValue({...profile,nickname:'custom_user',account:'custom_user'});return identity;});
 fireEvent.click(screen.getByRole('button',{name:'綁定賬號'}));await screen.findByText('已綁定');expect(screen.getAllByText('custom_user')).toHaveLength(2);expect(screen.queryByRole('button',{name:'綁定自定義賬號'})).not.toBeInTheDocument();expect(bindCustomAccount).toHaveBeenCalledWith('custom_user','password_123');expect(screen.getByRole('img',{name:'custom_user的頭像'})).toBeInTheDocument();
});
it('密碼不一致時不提交',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'綁定自定義賬號'}));fireEvent.change(screen.getByLabelText('會員賬號'),{target:{value:'custom_user'}});fireEvent.change(screen.getByLabelText('設置密碼'),{target:{value:'password_123'}});fireEvent.change(screen.getByLabelText('確認密碼'),{target:{value:'different'}});fireEvent.click(screen.getByRole('button',{name:'綁定賬號'}));expect(await screen.findByText('兩次密碼不一致')).toBeInTheDocument();expect(bindCustomAccount).not.toHaveBeenCalled();
});

it('頭像保存失敗保留已選頭像和重試入口',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'更換頭像'}));fireEvent.click(screen.getByRole('button',{name:'頭像 8'}));vi.mocked(updateAccountAvatar).mockRejectedValue(new Error('network'));fireEvent.click(screen.getByRole('button',{name:'保存'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'頭像 8'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:'保存'})).toBeEnabled();expect(screen.getByRole('img',{name:'當前頭像'})).toHaveAttribute('src','/assets/profile/avatar/3.png');
});
