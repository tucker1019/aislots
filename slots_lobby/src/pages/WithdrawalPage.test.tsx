import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WithdrawalPage} from './WithdrawalPage';
import {loadWithdrawalTurnover,loadWithdrawalTiers,createWithdrawal} from '../services/withdrawal';
vi.mock('../features/account/useAccountProfile',()=>({useAccountProfile:()=>({data:{uid:7,coins:10000},isError:false,isFetching:false,refetch:vi.fn()})}));
vi.mock('../services/withdrawal',()=>({loadWithdrawalTurnover:vi.fn(),loadWithdrawalTiers:vi.fn(),createWithdrawal:vi.fn()}));
vi.mock('../services/wallet-accounts',()=>({loadWalletAccounts:vi.fn().mockResolvedValue([{channel:'test1',account:'001',name:'name',bound:true}])}));
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();vi.mocked(loadWithdrawalTiers).mockResolvedValue({items:[{id:'50',amount:5000,fee:0,bonus:0,payoutAmount:5000}],testMode:false});});
it('流水接口失敗不顯示0，不開放取款，重試只請求失敗接口',async()=>{
 vi.mocked(loadWithdrawalTurnover).mockRejectedValueOnce(new Error('network')).mockResolvedValue({remaining:126000,canWithdraw:false});
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><WithdrawalPage onBack={vi.fn()}/></QueryClientProvider>);
 const retry=await screen.findByRole('button',{name:'重試'});expect(screen.queryByRole('button',{name:'發起取款'})).not.toBeInTheDocument();fireEvent.click(retry);
 expect(await screen.findByText('還需完成 1,260.00 有效流水後才可取款。')).toBeInTheDocument();expect(screen.getByRole('button',{name:'發起取款'})).toBeDisabled();expect(loadWithdrawalTiers).toHaveBeenCalledTimes(1);expect(loadWithdrawalTurnover).toHaveBeenCalledTimes(2);expect(createWithdrawal).not.toHaveBeenCalled();
});
it('已有流水數據刷新失敗保留金額，但禁止新申請',async()=>{
 vi.mocked(loadWithdrawalTurnover).mockRejectedValue(new Error('network'));const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});client.setQueryData(['withdrawal-turnover',7],{remaining:5000,canWithdraw:false});
 render(<QueryClientProvider client={client}><WithdrawalPage onBack={vi.fn()}/></QueryClientProvider>);expect(await screen.findByText('還需完成 50.00 有效流水後才可取款。')).toBeInTheDocument();await waitFor(()=>expect(screen.getByRole('button',{name:'重試'})).toBeEnabled());expect(screen.getByRole('button',{name:'發起取款'})).toBeDisabled();expect(createWithdrawal).not.toHaveBeenCalled();
});
