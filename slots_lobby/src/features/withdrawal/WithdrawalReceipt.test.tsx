import {afterEach,expect,it,vi} from 'vitest';
import {act,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider,focusManager,onlineManager} from '@tanstack/react-query';
import {WithdrawalReceipt} from './WithdrawalReceipt';
import {fetchWithdrawal} from '../../services/withdrawal';
import {useSessionStore} from '../../stores/session';
import {t} from '../../i18n';
vi.mock('../../services/withdrawal',()=>({fetchWithdrawal:vi.fn(),reviewWithdrawal:vi.fn()}));
const order={orderId:'wdr_test',kind:'withdrawal' as const,amount:50000,fee:0,bonus:0,creditAmount:50000,status:'pending' as const,channel:'test1',account:'123',name:'test',createdAt:'2026-11-06T00:00:00Z',settledAt:'',testMode:false,paymentUrl:''};
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();focusManager.setFocused(undefined);onlineManager.setOnline(true);});
function mount(){useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}});const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});render(<QueryClientProvider client={client}><WithdrawalReceipt orderId={order.orderId}/></QueryClientProvider>);return client;}
it('reads once without polling, focus or reconnect requests',async()=>{vi.mocked(fetchWithdrawal).mockResolvedValue(order);vi.useFakeTimers();const client=mount();await act(async()=>{await vi.advanceTimersByTimeAsync(50);});expect(fetchWithdrawal).toHaveBeenCalledTimes(1);await act(async()=>{await vi.advanceTimersByTimeAsync(15000);focusManager.setFocused(false);focusManager.setFocused(true);onlineManager.setOnline(false);onlineManager.setOnline(true);await vi.advanceTimersByTimeAsync(50);});expect(fetchWithdrawal).toHaveBeenCalledTimes(1);client.clear();});
it('returned order shows status without wallet refund explanation',async()=>{vi.mocked(fetchWithdrawal).mockResolvedValue({...order,status:'failed'});const client=mount();expect(await screen.findByText(t('withdrawal.status.failed'))).toBeInTheDocument();expect(screen.queryByText(t('withdrawal.refunded'))).not.toBeInTheDocument();client.clear();});
