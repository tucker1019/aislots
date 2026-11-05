import {expect,it,vi} from 'vitest';
import {render,screen,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {RebateRulesPage} from './RebateRulesPage';
vi.mock('../services/rebate',()=>({fetchRebate:vi.fn().mockResolvedValue({activityDate:'2026-11-03',timezone:'Asia/Jakarta',claimableTotal:0,daily:{reward:227},weekly:{reward:12},monthly:{reward:12},platforms:[{name:'AG',dailyRateBps:80,weeklyRateBps:10,monthlyRateBps:10}]})}));
it('直接打開規則頁顯示預估合計和平台四種比例',async()=>{
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><RebateRulesPage onBack={vi.fn()}/></QueryClientProvider>);
 expect(await screen.findByText('2.51')).toBeInTheDocument();const table=screen.getByRole('table',{name:'平台反水比例'});expect(within(table).getByText('AG')).toBeInTheDocument();expect(within(table).getByText('1%')).toBeInTheDocument();expect(within(table).getByText('0.8%')).toBeInTheDocument();expect(within(table).getAllByText('0.1%')).toHaveLength(2);expect(screen.getByRole('button',{name:'返回賺錢'})).toBeEnabled();
});
