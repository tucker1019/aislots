import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WithdrawalForm} from './WithdrawalForm';
import {createWithdrawal} from '../../services/withdrawal';
vi.mock('../../services/withdrawal',()=>({createWithdrawal:vi.fn()}));
vi.mock('../../services/wallet-accounts',()=>({loadWalletAccounts:vi.fn().mockResolvedValue([{channel:'test1',account:'123',name:'測試',bound:true}])}));
const tiers=[{id:'50',amount:5000,fee:150,bonus:0,payoutAmount:4850}];
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();});
function setup(coins=10000,remainingTurnover=0){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><WithdrawalForm uid={7} coins={coins} remainingTurnover={remainingTurnover} tiers={tiers}/></QueryClientProvider>);return userEvent.setup();}
it('餘額不足不允許提交，顯示手續費扣減後的到賬金額',async()=>{setup(100);expect(await screen.findByText('餘額不足')).toBeInTheDocument();expect(screen.getByRole('button',{name:'發起取款'})).toBeDisabled();expect(screen.getByText('48.50')).toBeInTheDocument();expect(createWithdrawal).not.toHaveBeenCalled();});
it('恢復未確認申請並用同一個請求號重試',async()=>{localStorage.setItem('withdrawal-pending-7',JSON.stringify({tierId:'50',channel:'test1',requestId:'stable-request-identifier'}));vi.mocked(createWithdrawal).mockRejectedValue(new Error('offline'));const user=setup();const retry=await screen.findByRole('button',{name:'重試原申請'});await waitFor(()=>expect(retry).toBeEnabled());await user.click(retry);await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'重試原申請'}));await waitFor(()=>expect(createWithdrawal).toHaveBeenCalledTimes(2));for(const call of vi.mocked(createWithdrawal).mock.calls)expect(call).toEqual(['50','test1','stable-request-identifier',7]);expect(screen.getByRole('button',{name:/50.00/})).toBeDisabled();});

it('有剩餘流水時禁止新申請，展示還需完成的金額',async()=>{setup(10000,126000);expect(await screen.findByText('還需完成 1,260.00 有效流水後才可取款。')).toBeInTheDocument();expect(screen.getByRole('button',{name:'發起取款'})).toBeDisabled();expect(createWithdrawal).not.toHaveBeenCalled();});
it('新增流水要求不能阻止確認已有請求的結果',async()=>{localStorage.setItem('withdrawal-pending-7',JSON.stringify({tierId:'50',channel:'test1',requestId:'existing-before-new-credit'}));vi.mocked(createWithdrawal).mockRejectedValue(new Error('offline'));const user=setup(10000,126000);const retry=await screen.findByRole('button',{name:'重試原申請'});await waitFor(()=>expect(retry).toBeEnabled());await user.click(retry);await waitFor(()=>expect(createWithdrawal).toHaveBeenCalledWith('50','test1','existing-before-new-credit',7));});
