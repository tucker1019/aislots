import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {InviteFriendsPage} from './InviteFriendsPage';
import {fetchInviteFriends} from '../services/invite-details';
vi.mock('../services/invite-details',()=>({fetchInviteFriends:vi.fn()}));
const friend={uid:'10000003',account:'friend',registeredAt:'2026-11-03T00:00:00Z',depositCount:4,depositAmount:40000,betAmount:500000,qualified:false,reasons:['deposit_count','deposit_amount'] as const,requiredDepositCount:5,requiredDepositAmount:50000,requiredBetAmount:500000,durationDays:30};
beforeEach(()=>vi.mocked(fetchInviteFriends).mockReset());
it('否点查看仅展示30日内未满足的条件，不附加APP或绑定要求',async()=>{
 vi.mocked(fetchInviteFriends).mockResolvedValue({page:1,hasMore:false,items:[{...friend,reasons:[...friend.reasons]},{...friend,uid:'10000004',account:'qualified',qualified:true,reasons:[]}]});render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><InviteFriendsPage onBack={vi.fn()}/></QueryClientProvider>);await screen.findByText('friend');expect(screen.getAllByRole('button',{name:'查看'})).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'查看'}));expect(await screen.findByText('注册后 30 日内成功存款次数不足：4 / 5 次。')).toBeInTheDocument();expect(screen.getByText('注册后 30 日内累计存款本金不足：400.00 / 500.00。')).toBeInTheDocument();expect(screen.queryByText(/累计投注额不足/)).not.toBeInTheDocument();expect(screen.queryByText(/绑定|APP|IP/)).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'我知道了'}));
});
