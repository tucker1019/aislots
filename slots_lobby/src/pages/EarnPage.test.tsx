import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {EarnPage} from './EarnPage';
import {fetchRebate,claimRebate} from '../services/rebate';
vi.mock('../features/invite/InviteChests',()=>({InviteChests:()=>null}));
vi.mock('../services/rebate',()=>({fetchRebate:vi.fn(),claimRebate:vi.fn()}));
const info={activityDate:'2026-11-03',timezone:'Asia/Jakarta',claimableTotal:100,daily:{reward:227,availableAt:'2026-11-04T00:00:00+07:00'},weekly:{reward:12,availableAt:'2026-11-09T00:00:00+07:00'},monthly:{reward:12,availableAt:'2026-12-01T00:00:00+07:00'},platforms:[{name:'AG',dailyRateBps:80,weeklyRateBps:10,monthlyRateBps:10}]};
beforeEach(()=>{vi.mocked(fetchRebate).mockReset();vi.mocked(claimRebate).mockReset();});
function setup(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><EarnPage/></QueryClientProvider>);}
it('真实预估及平台比例，不显示具体游戏，领取使用活动日期',async()=>{
 vi.mocked(fetchRebate).mockResolvedValue(info);vi.mocked(claimRebate).mockResolvedValue(100);setup();expect(await screen.findByText('AG')).toBeInTheDocument();expect(screen.getByText('1%')).toBeInTheDocument();expect(screen.getByText('2.27')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'领取'}));await waitFor(()=>expect(claimRebate).toHaveBeenCalledWith('2026-11-03',expect.anything()));expect(await screen.findByText('领取成功，获得 1.00')).toBeInTheDocument();expect(await screen.findByText('领取成功',{exact:true})).toBeInTheDocument();expect(screen.getByRole('button',{name:'领取'})).toBeDisabled();
});
it('无金额不能领取，规则可以展开',async()=>{vi.mocked(fetchRebate).mockResolvedValue({...info,claimableTotal:0});setup();expect(await screen.findByRole('button',{name:'领取'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:/规则查看/}));expect(window.location.pathname).toBe('/earn/rules');});
it('错误显示重试',async()=>{vi.mocked(fetchRebate).mockRejectedValue(new Error('network'));setup();expect(await screen.findByRole('button',{name:'重试'})).toBeEnabled();});
