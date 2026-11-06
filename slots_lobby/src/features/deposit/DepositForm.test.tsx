import { DepositTracker } from './DepositTracker';
import { useSessionStore } from '../../stores/session';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DepositForm } from './DepositForm';
import { createRecharge, fetchRechargeOrder } from '../../services/recharge';
import { readIntent, saveIntent } from './intent';
vi.mock('../../services/recharge',()=>({createRecharge:vi.fn(),fetchRechargeOrder:vi.fn(),paymentLink:(url:string)=>url||undefined}));
const successNotice=vi.fn();
const tier={id:'a',amount:1000,bonus:0,fee:20,creditAmount:980};
const order={orderId:'order-1',paymentUrl:'https://example.com',status:'success' as const,amount:1000,bonus:0,fee:20,creditAmount:980,createdAt:'2026-11-03T00:00:00Z'};
beforeEach(()=>{vi.spyOn(window,'open').mockReturnValue({opener:null,close:vi.fn(),location:{replace:vi.fn()}} as unknown as Window);sessionStorage.clear();useSessionStore.getState().setSession({uid:7,sid:'s'.repeat(52),expiresAt:'2099-01-01T00:00:00Z'});successNotice.mockReset();vi.mocked(createRecharge).mockReset();vi.mocked(fetchRechargeOrder).mockReset();});
function setup(tiers=[tier]){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><DepositTracker onSuccess={successNotice}/><DepositForm uid={7} tiers={tiers}/></QueryClientProvider>);return Object.assign(userEvent.setup(),{client});}
it('響應丟失重試復用同一請求號，到賬明細正確',async()=>{
 vi.mocked(createRecharge).mockRejectedValueOnce(new Error('連接中斷')).mockResolvedValueOnce({orderId:'order-1',status:'pending',paymentUrl:'https://example.com'});
 vi.mocked(fetchRechargeOrder).mockResolvedValue(order);
 const user=setup();
 expect(screen.getByText('9.80')).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'確認創建訂單'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('連接中斷');
 const saved=readIntent(7);
 await user.click(screen.getByRole('button',{name:'確認創建訂單'}));
 await waitFor(()=>expect(successNotice).toHaveBeenCalledTimes(1));
 expect(screen.getByRole('button',{name:'確認創建訂單'})).toBeEnabled();
 expect(screen.queryByRole('region',{name:'充值訂單'})).not.toBeInTheDocument();
 expect(readIntent(7)).toBeNull();
 expect(vi.mocked(createRecharge).mock.calls[0]).toEqual(['a',saved?.requestId,7]);
 expect(vi.mocked(createRecharge).mock.calls[1]).toEqual(vi.mocked(createRecharge).mock.calls[0]);
});
it('刷新恢復已知訂單只查詢狀態，不再次創建',async()=>{
 saveIntent(7,{tierId:'a',requestId:'saved-id',orderId:'order-1'});
 vi.mocked(fetchRechargeOrder).mockResolvedValue(order);
 setup();
 await waitFor(()=>expect(successNotice).toHaveBeenCalledTimes(1));
 expect(screen.getByRole('button',{name:'確認創建訂單'})).toBeEnabled();
 expect(screen.queryByRole('region',{name:'充值訂單'})).not.toBeInTheDocument();
 expect(readIntent(7)).toBeNull();
 await waitFor(()=>expect(fetchRechargeOrder).toHaveBeenCalled());
 expect(createRecharge).not.toHaveBeenCalled();
});

it('手續費和贈送使用百分比角標，卡片沒有底部費用說明',()=>{
 setup([tier,{id:'b',amount:20000,bonus:600,fee:0,creditAmount:20600}]);
 expect(screen.getByText('手續費2%')).toHaveClass('tier-fee');
 expect(screen.getByText('送3%')).toHaveClass('tier-bonus');
 expect(screen.queryByText('無手續費')).not.toBeInTheDocument();
});

it('付款直接打开新窗口，后台查单不切换按钮文字或loading',async()=>{
 const replace=vi.fn();vi.mocked(window.open).mockReturnValue({opener:null,close:vi.fn(),location:{replace}} as unknown as Window);
 const pending={...order,status:'pending' as const};
 vi.mocked(createRecharge).mockResolvedValue({orderId:'order-1',status:'pending',paymentUrl:pending.paymentUrl});
 vi.mocked(fetchRechargeOrder).mockResolvedValue(pending);
 const user=setup();await user.click(screen.getByRole('button',{name:'確認創建訂單'}));
 await waitFor(()=>expect(replace).toHaveBeenCalledWith('https://example.com'));
 const button=screen.getByRole('button',{name:'確認創建訂單'});await waitFor(()=>expect(button).toBeEnabled());
 expect(screen.queryByText('等待付款確認')).not.toBeInTheDocument();
 let complete:(value:typeof pending)=>void=()=>{};
 vi.mocked(fetchRechargeOrder).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
 await act(async()=>{void user.client.refetchQueries({queryKey:['deposit-tracking',7]});});
 expect(button).toHaveAttribute('aria-busy','false');expect(button).toBeEnabled();expect(button).toHaveAccessibleName('確認創建訂單');
 await act(async()=>complete(pending));expect(createRecharge).toHaveBeenCalledTimes(1);expect(replace).toHaveBeenCalledTimes(1);
});
