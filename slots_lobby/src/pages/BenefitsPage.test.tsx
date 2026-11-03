import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BenefitsPage } from './BenefitsPage';
import { loadCheckinOverview, loadVipOverview } from '../services/benefits';
vi.mock('../services/benefits', () => ({loadCheckinOverview:vi.fn(),loadVipOverview:vi.fn()}));
beforeEach(() => {vi.mocked(loadCheckinOverview).mockReset();vi.mocked(loadVipOverview).mockReset();});
function setup() { const onAction=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><BenefitsPage onBack={vi.fn()} onComingSoon={onAction} /></QueryClientProvider>);return onAction; }
it('五张卡片用真实数据，中心页不请求签到，详情暂不领取', async () => {
 vi.mocked(loadCheckinOverview).mockResolvedValue({day:2,claimed:true,canClaim:false,reward:100});
 vi.mocked(loadVipOverview).mockResolvedValue({level:6,upgradeReward:8800,weeklyReward:1200,monthlyReward:2800,upgradeBet:25300,upgradeRecharge:100,nextBet:10000000,nextRecharge:200,protecting:false});
 const onAction=setup(); expect(await screen.findByText('VIP6')).toBeInTheDocument();
 for(const title of ['每日签到','每周礼金','每月礼金','晋级奖励','VIP中心'])expect(screen.getByRole('heading',{name:title})).toBeInTheDocument();
 expect(screen.getByText('12.00')).toBeInTheDocument();expect(screen.getByRole('button',{name:'签到'})).toBeEnabled(); expect(loadCheckinOverview).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'查看详情'}));expect(onAction).toHaveBeenCalledTimes(1);
});
it('一个接口失败不遮挡另一个接口结果，可单独重试',async()=>{
 vi.mocked(loadCheckinOverview).mockRejectedValue(new Error('network'));vi.mocked(loadVipOverview).mockRejectedValue(new Error('network'));
 setup();expect(screen.getByRole('button',{name:'签到'})).toBeEnabled(); expect(loadCheckinOverview).not.toHaveBeenCalled();expect(await screen.findByText('VIP 福利加载失败')).toBeInTheDocument();expect(screen.getByText('重试 VIP 福利')).toBeEnabled();
});
it('提升VIP弹出真实升级进度，获取流水跳首页，关闭不跳转',async()=>{
 vi.mocked(loadVipOverview).mockResolvedValue({level:6,upgradeReward:0,weeklyReward:1200,monthlyReward:2800,upgradeBet:25320,upgradeRecharge:100,nextBet:10000000,nextRecharge:200,protecting:false});
 window.history.replaceState(null,'','/benefits');setup();
 fireEvent.click(await screen.findByRole('button',{name:'提升VIP领取奖励'}));expect(await screen.findByRole('heading',{name:'VIP7升级条件'})).toBeInTheDocument();expect(screen.getByText('有效流水')).toBeInTheDocument();expect(screen.getByText('充值金额')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'关闭升级条件'}));expect(window.location.pathname).toBe('/benefits');
 fireEvent.click(screen.getByRole('button',{name:'提升VIP领取奖励'}));fireEvent.click(await screen.findByRole('button',{name:'获取流水'}));expect(window.location.pathname).toBe('/');
});
