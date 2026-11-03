import { DepositTracker } from './DepositTracker';
import { useSessionStore } from '../../stores/session';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DepositForm } from './DepositForm';
import { createRecharge, fetchRechargeOrder } from '../../services/recharge';
import { readIntent, saveIntent } from './intent';
vi.mock('../../services/recharge',()=>({createRecharge:vi.fn(),fetchRechargeOrder:vi.fn(),paymentLink:()=>undefined}));
const successNotice=vi.fn();
const tier={id:'a',amount:1000,bonus:0,fee:20,creditAmount:980};
const order={orderId:'order-1',paymentUrl:'https://example.com',status:'success' as const,amount:1000,bonus:0,fee:20,creditAmount:980,createdAt:'2026-11-03T00:00:00Z'};
beforeEach(()=>{sessionStorage.clear();useSessionStore.getState().setSession({uid:7,sid:'s'.repeat(52),expiresAt:'2099-01-01T00:00:00Z'});successNotice.mockReset();vi.mocked(createRecharge).mockReset();vi.mocked(fetchRechargeOrder).mockReset();});
function setup(tiers=[tier]){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><DepositTracker onSuccess={successNotice}/><DepositForm uid={7} tiers={tiers}/></QueryClientProvider>);return userEvent.setup();}
it('响应丢失重试复用同一请求号，到账明细正确',async()=>{
 vi.mocked(createRecharge).mockRejectedValueOnce(new Error('连接中断')).mockResolvedValueOnce({orderId:'order-1',status:'pending',paymentUrl:'https://example.com'});
 vi.mocked(fetchRechargeOrder).mockResolvedValue(order);
 const user=setup();
 expect(screen.getByText('9.80')).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'确认创建订单'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('连接中断');
 const saved=readIntent(7);
 await user.click(screen.getByRole('button',{name:'重试本次订单'}));
 await waitFor(()=>expect(successNotice).toHaveBeenCalledTimes(1));
 expect(screen.getByRole('button',{name:'确认创建订单'})).toBeEnabled();
 expect(screen.queryByRole('region',{name:'充值订单'})).not.toBeInTheDocument();
 expect(readIntent(7)).toBeNull();
 expect(vi.mocked(createRecharge).mock.calls[0]).toEqual(['a',saved?.requestId,7]);
 expect(vi.mocked(createRecharge).mock.calls[1]).toEqual(vi.mocked(createRecharge).mock.calls[0]);
});
it('刷新恢复已知订单只查询状态，不再次创建',async()=>{
 saveIntent(7,{tierId:'a',requestId:'saved-id',orderId:'order-1'});
 vi.mocked(fetchRechargeOrder).mockResolvedValue(order);
 setup();
 await waitFor(()=>expect(successNotice).toHaveBeenCalledTimes(1));
 expect(screen.getByRole('button',{name:'确认创建订单'})).toBeEnabled();
 expect(screen.queryByRole('region',{name:'充值订单'})).not.toBeInTheDocument();
 expect(readIntent(7)).toBeNull();
 await waitFor(()=>expect(fetchRechargeOrder).toHaveBeenCalled());
 expect(createRecharge).not.toHaveBeenCalled();
});

it('手续费和赠送使用百分比角标，卡片没有底部费用说明',()=>{
 setup([tier,{id:'b',amount:20000,bonus:600,fee:0,creditAmount:20600}]);
 expect(screen.getByText('手续费2%')).toHaveClass('tier-fee');
 expect(screen.getByText('送3%')).toHaveClass('tier-bonus');
 expect(screen.queryByText('无手续费')).not.toBeInTheDocument();
});
