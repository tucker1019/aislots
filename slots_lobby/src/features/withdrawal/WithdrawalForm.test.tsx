import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WithdrawalForm} from './WithdrawalForm';
import {loadWalletAccounts} from '../../services/wallet-accounts';
import {createWithdrawal} from '../../services/withdrawal';
vi.mock('../../services/withdrawal',()=>({createWithdrawal:vi.fn()}));
vi.mock('../../services/wallet-accounts',()=>({loadWalletAccounts:vi.fn().mockResolvedValue([{channel:'test1',account:'123',name:'測試',bound:true}])}));
const tiers=[{id:'50',amount:5000,fee:150,bonus:0,payoutAmount:4850}];
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();vi.mocked(loadWalletAccounts).mockResolvedValue([{channel:'test1',account:'123',name:'測試',bound:true}]);});
function setup(coins=10000){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><WithdrawalForm uid={7} coins={coins} tiers={tiers}/></QueryClientProvider>);return userEvent.setup();}
it('餘額不足不允許提交，顯示手續費扣減後的到賬金額',async()=>{setup(100);expect(screen.queryByText('餘額不足')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'發起取款'})).toBeDisabled();expect(screen.getByText('Rp48')).toBeInTheDocument();expect(createWithdrawal).not.toHaveBeenCalled();});
it('恢復未確認申請並用同一個請求號重試',async()=>{localStorage.setItem('withdrawal-pending-7',JSON.stringify({tierId:'50',channel:'test1',requestId:'stable-request-identifier'}));vi.mocked(createWithdrawal).mockRejectedValue(new Error('offline'));const user=setup();const retry=await screen.findByRole('button',{name:'重試原申請'});await waitFor(()=>expect(retry).toBeEnabled());await user.click(retry);await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'重試原申請'}));await waitFor(()=>expect(createWithdrawal).toHaveBeenCalledTimes(2));for(const call of vi.mocked(createWithdrawal).mock.calls)expect(call).toEqual(['50','test1','stable-request-identifier',7]);expect(screen.getByRole('button',{name:/50/})).toBeDisabled();});

it('提交後以服務端剩餘流水顯示提示，並解除原申請鎖定',async()=>{
 localStorage.setItem('withdrawal-pending-7',JSON.stringify({tierId:'50',channel:'test1',requestId:'prior-request-identifier'}));
 vi.mocked(createWithdrawal).mockRejectedValueOnce(new Error('rejected',{cause:{code:10010025,remainingTurnover:126000,turnoverItems:[{source:'rch_002',amount:50000,required:150000,completed:24000,createdAt:'2026-11-10T07:00:00Z'}]}}));
 const user=setup();
 const retry=await screen.findByRole('button',{name:'重試原申請'});
 expect(screen.queryByText(/還需完成/)).not.toBeInTheDocument();
 await waitFor(()=>expect(retry).toBeEnabled());
 await user.click(retry);
 expect(await screen.findByText('流水明細')).toBeInTheDocument();
 expect(screen.getByText('Rp1.260')).toBeInTheDocument();
 expect(screen.getByText('Rp240')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'發起取款'})).toBeEnabled();
 expect(localStorage.getItem('withdrawal-pending-7')).toBeNull();
});
it('新增流水要求不能阻止確認已有請求的結果',async()=>{localStorage.setItem('withdrawal-pending-7',JSON.stringify({tierId:'50',channel:'test1',requestId:'existing-before-new-credit'}));vi.mocked(createWithdrawal).mockRejectedValue(new Error('offline'));const user=setup();const retry=await screen.findByRole('button',{name:'重試原申請'});await waitFor(()=>expect(retry).toBeEnabled());await user.click(retry);await waitFor(()=>expect(createWithdrawal).toHaveBeenCalledWith('50','test1','existing-before-new-credit',7));});

it('unbound accounts show a wallet binding action instead of a channel selector',async()=>{
 vi.mocked(loadWalletAccounts).mockResolvedValue([{channel:'test1',account:'',name:'',bound:false}]);setup();
 expect(await screen.findByRole('button',{name:'請先綁定錢包'})).toBeInTheDocument();expect(screen.queryByRole('combobox')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'發起取款'})).toBeDisabled();
});
it('automatically selects the server preferred wallet for submission',async()=>{
 vi.mocked(loadWalletAccounts).mockResolvedValue([{channel:'test1',account:'123',name:'First',bound:true},{channel:'test2',account:'456',name:'Last used',bound:true,preferred:true}]);
 vi.mocked(createWithdrawal).mockRejectedValue(new Error('offline'));const user=setup();await screen.findByText('test2 · 456 · Last used');const submit=screen.getByRole('button',{name:'發起取款'});await waitFor(()=>expect(submit).toBeEnabled());await user.click(submit);
 await waitFor(()=>expect(createWithdrawal).toHaveBeenCalledWith('50','test2',expect.any(String),7));
});
