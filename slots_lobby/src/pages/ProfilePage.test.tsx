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
it('個人資料僅展示會員ID、賬號，選擇平台頭像後同步頂欄',async()=>{
 setup();await screen.findByText('遊客賬號');expect(screen.queryByText('會員姓名')).not.toBeInTheDocument();expect(screen.queryByText('手機號')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'更換頭像'}));expect(screen.getAllByRole('button',{name:/^頭像 \d+$/})).toHaveLength(15);
 vi.mocked(updateAccountAvatar).mockImplementation(async()=>{const next={...profile,avatarId:8};vi.mocked(loadAccountProfile).mockResolvedValue(next);return next;});
 fireEvent.click(screen.getByRole('button',{name:'頭像 8'}));fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(screen.getByRole('img',{name:'當前頭像'})).toHaveAttribute('src','/assets/profile/avatar/8.png'));expect(screen.getByRole('img',{name:'player_7的頭像'})).toHaveAttribute('src','/assets/profile/avatar/8.png');expect(updateAccountAvatar).toHaveBeenCalledWith(8);
});
it('不再展示绑定账号入口或已绑定状态',async()=>{vi.mocked(loadAccountProfile).mockResolvedValue({...profile,account:'custom_user'});setup();await screen.findByText('custom_user');expect(screen.queryByText('綁定自定義賬號')).not.toBeInTheDocument();expect(screen.queryByText('已綁定')).not.toBeInTheDocument();});
it('頭像保存失敗保留已選頭像和重試入口',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'更換頭像'}));fireEvent.click(screen.getByRole('button',{name:'頭像 8'}));vi.mocked(updateAccountAvatar).mockRejectedValue(new Error('network'));fireEvent.click(screen.getByRole('button',{name:'保存'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'頭像 8'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:'保存'})).toBeEnabled();expect(screen.getByRole('img',{name:'當前頭像'})).toHaveAttribute('src','/assets/profile/avatar/3.png');
});
