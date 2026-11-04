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
it('个人资料仅展示会员ID、账号及绑定入口，选择平台头像后同步顶栏',async()=>{
 setup();await screen.findByText('游客账号');expect(screen.queryByText('会员姓名')).not.toBeInTheDocument();expect(screen.queryByText('手机号')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'更换头像'}));expect(screen.getAllByRole('button',{name:/^头像 \d+$/})).toHaveLength(15);
 vi.mocked(updateAccountAvatar).mockImplementation(async()=>{const next={...profile,avatarId:8};vi.mocked(loadAccountProfile).mockResolvedValue(next);return next;});
 fireEvent.click(screen.getByRole('button',{name:'头像 8'}));fireEvent.click(screen.getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(screen.getByRole('img',{name:'当前头像'})).toHaveAttribute('src','/assets/profile/avatar/8.png'));expect(screen.getByRole('img',{name:'player_7的头像'})).toHaveAttribute('src','/assets/profile/avatar/8.png');expect(updateAccountAvatar).toHaveBeenCalledWith(8);
});
it('绑定账号同时更新昵称和绑定状态，不再提供绑定按钮',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'绑定自定义账号'}));
 fireEvent.change(screen.getByLabelText('会员账号'),{target:{value:'custom_user'}});fireEvent.change(screen.getByLabelText('设置密码'),{target:{value:'password_123'}});fireEvent.change(screen.getByLabelText('确认密码'),{target:{value:'password_123'}});
 vi.mocked(bindCustomAccount).mockImplementation(async()=>{vi.mocked(loadAccountProfile).mockResolvedValue({...profile,nickname:'custom_user',account:'custom_user'});return identity;});
 fireEvent.click(screen.getByRole('button',{name:'绑定账号'}));await screen.findByText('已绑定');expect(screen.getAllByText('custom_user')).toHaveLength(2);expect(screen.queryByRole('button',{name:'绑定自定义账号'})).not.toBeInTheDocument();expect(bindCustomAccount).toHaveBeenCalledWith('custom_user','password_123');expect(screen.getByRole('img',{name:'custom_user的头像'})).toBeInTheDocument();
});
it('密码不一致时不提交',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'绑定自定义账号'}));fireEvent.change(screen.getByLabelText('会员账号'),{target:{value:'custom_user'}});fireEvent.change(screen.getByLabelText('设置密码'),{target:{value:'password_123'}});fireEvent.change(screen.getByLabelText('确认密码'),{target:{value:'different'}});fireEvent.click(screen.getByRole('button',{name:'绑定账号'}));expect(await screen.findByText('两次密码不一致')).toBeInTheDocument();expect(bindCustomAccount).not.toHaveBeenCalled();
});

it('头像保存失败保留已选头像和重试入口',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'更换头像'}));fireEvent.click(screen.getByRole('button',{name:'头像 8'}));vi.mocked(updateAccountAvatar).mockRejectedValue(new Error('network'));fireEvent.click(screen.getByRole('button',{name:'保存'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'头像 8'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:'保存'})).toBeEnabled();expect(screen.getByRole('img',{name:'当前头像'})).toHaveAttribute('src','/assets/profile/avatar/3.png');
});
