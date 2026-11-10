import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WithdrawalPage} from './WithdrawalPage';
import {loadWithdrawalTurnover,loadWithdrawalTiers,createWithdrawal} from '../services/withdrawal';
vi.mock('../features/account/useAccountProfile',()=>({useAccountProfile:()=>({data:{uid:7,coins:10000},isError:false,isFetching:false,refetch:vi.fn()})}));
vi.mock('../services/withdrawal',()=>({loadWithdrawalTurnover:vi.fn(),loadWithdrawalTiers:vi.fn(),createWithdrawal:vi.fn()}));
vi.mock('../services/wallet-accounts',()=>({loadWalletAccounts:vi.fn().mockResolvedValue([{channel:'test1',account:'001',name:'name',bound:true}])}));
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();vi.mocked(loadWithdrawalTiers).mockResolvedValue({items:[{id:'50',amount:5000,fee:0,bonus:0,payoutAmount:5000}],testMode:false});});
it('取款頁不預查流水，也不顯示剩餘流水',async()=>{
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><WithdrawalPage onBack={vi.fn()}/></QueryClientProvider>);
 expect(await screen.findByRole('button',{name:'發起取款'})).toBeInTheDocument();
 expect(screen.queryByText(/還需完成|待完成有效流水/)).not.toBeInTheDocument();
 expect(loadWithdrawalTurnover).not.toHaveBeenCalled();
 expect(createWithdrawal).not.toHaveBeenCalled();
});
