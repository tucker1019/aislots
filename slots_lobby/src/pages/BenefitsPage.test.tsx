import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BenefitsPage } from './BenefitsPage';
import { loadCheckinOverview, loadVipOverview } from '../services/benefits';
vi.mock('../services/benefits', () => ({loadCheckinOverview:vi.fn(),loadVipOverview:vi.fn()}));
beforeEach(() => {vi.mocked(loadCheckinOverview).mockReset();vi.mocked(loadVipOverview).mockReset();});
function setup() { const onAction=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><BenefitsPage onBack={vi.fn()} onComingSoon={onAction} /></QueryClientProvider>);return onAction; }
it('五張卡片用真實數據，中心頁不請求籤到，詳情暫不領取', async () => {
 vi.mocked(loadCheckinOverview).mockResolvedValue({day:2,claimed:true,canClaim:false,reward:100});
 vi.mocked(loadVipOverview).mockResolvedValue({level:6,upgradeReward:8800,weeklyReward:1200,monthlyReward:2800,upgradeBet:25300,upgradeRecharge:100,nextBet:10000000,nextRecharge:200,protecting:false});
 const onAction=setup(); expect(await screen.findByText('VIP6')).toBeInTheDocument();
 for(const title of ['每日簽到','每周禮金','每月禮金','晉級獎勵','VIP中心'])expect(screen.getByRole('heading',{name:title})).toBeInTheDocument();
 expect(screen.getByText('12.00')).toBeInTheDocument();expect(screen.getByRole('button',{name:'簽到'})).toBeEnabled(); expect(loadCheckinOverview).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'查看詳情'}));expect(onAction).toHaveBeenCalledTimes(1);
});
it('一個接口失敗不遮擋另一個接口結果，可單獨重試',async()=>{
 vi.mocked(loadCheckinOverview).mockRejectedValue(new Error('network'));vi.mocked(loadVipOverview).mockRejectedValue(new Error('network'));
 setup();expect(screen.getByRole('button',{name:'簽到'})).toBeEnabled(); expect(loadCheckinOverview).not.toHaveBeenCalled();expect(await screen.findByText('網絡異常，請重試')).toBeInTheDocument();expect(screen.getByText('重試')).toBeEnabled();
});
it('提升VIP彈出真實升級進度，獲取流水跳首頁，關閉不跳轉',async()=>{
 vi.mocked(loadVipOverview).mockResolvedValue({level:6,upgradeReward:0,weeklyReward:1200,monthlyReward:2800,upgradeBet:25320,upgradeRecharge:100,nextBet:10000000,nextRecharge:200,protecting:false});
 window.history.replaceState(null,'','/benefits');setup();
 fireEvent.click(await screen.findByRole('button',{name:'提升VIP領取獎勵'}));expect(await screen.findByRole('heading',{name:'VIP7升級條件'})).toBeInTheDocument();expect(screen.getByText('有效流水')).toBeInTheDocument();expect(screen.getByText('充值金額')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'關閉升級條件'}));expect(window.location.pathname).toBe('/benefits');
 fireEvent.click(screen.getByRole('button',{name:'提升VIP領取獎勵'}));fireEvent.click(await screen.findByRole('button',{name:'獲取流水'}));expect(window.location.pathname).toBe('/');
});
