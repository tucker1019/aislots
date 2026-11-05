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
it('預估即使進度達標仍只顯示領取進度，月禮金條件真實展示',async()=>{
 setup({...base,monthlyPreview:{...period,actualBet:120000,actualRecharge:20000}},'monthly');fireEvent.click(screen.getByRole('button',{name:'領取進度'}));expect(await screen.findByRole('heading',{name:'每月禮金領取條件'})).toBeInTheDocument();expect(screen.getByText('當月存款')).toBeInTheDocument();expect(screen.getByText('當月流水')).toBeInTheDocument();expect(claimVipReward).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'知道了'}));
});
it('服務端可領才直接領取，成功後已領取並禁用',async()=>{
 vi.mocked(claimVipReward).mockResolvedValue(1200);setup({...base,weekly:{...period,status:'claimable'}});fireEvent.click(screen.getByRole('button',{name:'領取'}));expect(await screen.findByRole('button',{name:'已領取'})).toBeDisabled();expect(claimVipReward).toHaveBeenCalledWith('weekly','2026-11-03',expect.any(String));
});
it('領取失敗重試沿用同一請求號',async()=>{
 vi.mocked(claimVipReward).mockRejectedValueOnce(new Error('網絡異常')).mockResolvedValueOnce(1200);setup({...base,monthly:{...period,status:'claimable'}},'monthly');fireEvent.click(screen.getByRole('button',{name:'領取'}));fireEvent.click(await screen.findByRole('button',{name:'重試領取'}));await waitFor(()=>expect(claimVipReward).toHaveBeenCalledTimes(2));expect(vi.mocked(claimVipReward).mock.calls[1]).toEqual(vi.mocked(claimVipReward).mock.calls[0]);
});
it('服務端已領取禁用按鈕',()=>{setup({...base,weekly:{...period,status:'claimed'}});expect(screen.getByRole('button',{name:'已領取'})).toBeDisabled();});
