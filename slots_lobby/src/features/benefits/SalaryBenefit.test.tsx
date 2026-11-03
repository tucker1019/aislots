import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {SalaryBenefit} from './SalaryBenefit';
import {claimVipReward} from '../../services/vip-details';
import type {VipOverview} from '../../services/benefits';
vi.mock('../../services/vip-details',()=>({claimVipReward:vi.fn()}));
const period={amount:1200,status:'preview',actualBet:25320,actualRecharge:10000,requiredBet:120000,requiredRecharge:20000,availableAt:'2026-11-09T00:00:00+07:00',expiresAt:'2026-11-10T00:00:00+07:00'};
const base:VipOverview={activityDate:'2026-11-03',timezone:'Asia/Jakarta',level:6,upgradeReward:0,weeklyReward:1200,monthlyReward:2800,upgradeBet:0,upgradeRecharge:0,nextBet:100000,nextRecharge:0,protecting:false,weekly:{...period,status:'no_reward'},monthly:{...period,status:'no_reward'},weeklyPreview:period,monthlyPreview:period};
beforeEach(()=>vi.mocked(claimVipReward).mockReset());
function setup(info:VipOverview,kind:'weekly'|'monthly'='weekly'){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><SalaryBenefit kind={kind} info={info}/></QueryClientProvider>);}
it('预估即使进度达标仍只显示领取进度，月礼金条件真实展示',async()=>{
 setup({...base,monthlyPreview:{...period,actualBet:120000,actualRecharge:20000}},'monthly');fireEvent.click(screen.getByRole('button',{name:'领取进度'}));expect(await screen.findByRole('heading',{name:'每月礼金领取条件'})).toBeInTheDocument();expect(screen.getByText('当月存款')).toBeInTheDocument();expect(screen.getByText('当月流水')).toBeInTheDocument();expect(claimVipReward).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'知道了'}));
});
it('服务端可领才直接领取，成功后已领取并禁用',async()=>{
 vi.mocked(claimVipReward).mockResolvedValue(1200);setup({...base,weekly:{...period,status:'claimable'}});fireEvent.click(screen.getByRole('button',{name:'领取'}));expect(await screen.findByRole('button',{name:'已领取'})).toBeDisabled();expect(claimVipReward).toHaveBeenCalledWith('weekly','2026-11-03',expect.any(String));
});
it('领取失败重试沿用同一请求号',async()=>{
 vi.mocked(claimVipReward).mockRejectedValueOnce(new Error('网络异常')).mockResolvedValueOnce(1200);setup({...base,monthly:{...period,status:'claimable'}},'monthly');fireEvent.click(screen.getByRole('button',{name:'领取'}));fireEvent.click(await screen.findByRole('button',{name:'重试领取'}));await waitFor(()=>expect(claimVipReward).toHaveBeenCalledTimes(2));expect(vi.mocked(claimVipReward).mock.calls[1]).toEqual(vi.mocked(claimVipReward).mock.calls[0]);
});
it('服务端已领取禁用按钮',()=>{setup({...base,weekly:{...period,status:'claimed'}});expect(screen.getByRole('button',{name:'已领取'})).toBeDisabled();});
