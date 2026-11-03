import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WithdrawalForm} from './WithdrawalForm';
import {createWithdrawal} from '../../services/withdrawal';
vi.mock('../../services/withdrawal',()=>({createWithdrawal:vi.fn()}));
vi.mock('../../services/wallet-accounts',()=>({loadWalletAccounts:vi.fn().mockResolvedValue([{channel:'test1',account:'123',name:'测试',bound:true}])}));
const tiers=[{id:'50',amount:5000,fee:150,bonus:0,payoutAmount:4850}];
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();});
function setup(coins=10000){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><WithdrawalForm uid={7} coins={coins} tiers={tiers}/></QueryClientProvider>);return userEvent.setup();}
it('余额不足不允许提交，显示手续费扣减后的到账金额',async()=>{setup(100);expect(await screen.findByText('余额不足')).toBeInTheDocument();expect(screen.getByRole('button',{name:'发起取款'})).toBeDisabled();expect(screen.getByText('48.50')).toBeInTheDocument();expect(createWithdrawal).not.toHaveBeenCalled();});
it('恢复未确认申请并用同一个请求号重试',async()=>{localStorage.setItem('withdrawal-pending-7',JSON.stringify({tierId:'50',channel:'test1',requestId:'stable-request-identifier'}));vi.mocked(createWithdrawal).mockRejectedValue(new Error('offline'));const user=setup();const retry=await screen.findByRole('button',{name:'重试原申请'});await waitFor(()=>expect(retry).toBeEnabled());await user.click(retry);await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'重试原申请'}));await waitFor(()=>expect(createWithdrawal).toHaveBeenCalledTimes(2));for(const call of vi.mocked(createWithdrawal).mock.calls)expect(call).toEqual(['50','test1','stable-request-identifier',7]);expect(screen.getByRole('button',{name:/50.00/})).toBeDisabled();});
