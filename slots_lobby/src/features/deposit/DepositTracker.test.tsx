import {useState} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {DepositTracker} from './DepositTracker';
import {DepositForm} from './DepositForm';
import {saveIntent,readIntent} from './intent';
import {useSessionStore} from '../../stores/session';
import {createRecharge,fetchRechargeOrder} from '../../services/recharge';
vi.mock('../../services/recharge',()=>({createRecharge:vi.fn(),fetchRechargeOrder:vi.fn(),paymentLink:()=>undefined}));
const tier={id:'a',amount:1000,bonus:0,fee:20,creditAmount:980};
const pending={...tier,orderId:'order-1',paymentUrl:'',createdAt:'2026-11-03T00:00:00Z',status:'pending' as const};
beforeEach(()=>{sessionStorage.clear();useSessionStore.getState().setSession({uid:7,sid:'s'.repeat(52),expiresAt:'2099-01-01T00:00:00Z'});vi.mocked(createRecharge).mockReset();vi.mocked(fetchRechargeOrder).mockReset();});
it('離開頁面仍跟蹤，到賬刷新餘額，未展示記錄只過期',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});const notice=vi.fn();let balance=100;const profile=vi.fn(async()=>balance);client.setQueryData(['cash-records',7],{items:[]});
 vi.mocked(createRecharge).mockResolvedValue({orderId:'order-1',paymentUrl:'',status:'pending'});vi.mocked(fetchRechargeOrder).mockResolvedValue(pending);
 function Host(){const [deposit,setDeposit]=useState(true);const coins=useQuery({queryKey:['lobby','current-profile'],queryFn:profile});return <><DepositTracker onSuccess={notice}/><output>餘額 {coins.data}</output><button onClick={()=>setDeposit(false)}>去首頁</button>{deposit&&<DepositForm uid={7} tiers={[tier]}/>}</>;}
 render(<QueryClientProvider client={client}><Host/></QueryClientProvider>);fireEvent.click(screen.getByRole('button',{name:'確認創建訂單'}));await waitFor(()=>expect(fetchRechargeOrder).toHaveBeenCalled());fireEvent.click(screen.getByText('去首頁'));expect(screen.queryByText('選擇存款金額')).not.toBeInTheDocument();
 balance=1080;vi.mocked(fetchRechargeOrder).mockResolvedValue({...pending,status:'success'});await act(async()=>{await client.refetchQueries({queryKey:['deposit-tracking',7]});});
 expect(await screen.findByText('餘額 1080')).toBeInTheDocument();await waitFor(()=>expect(notice).toHaveBeenCalledTimes(1));expect(readIntent(7)).toBeNull();expect(client.getQueryState(['cash-records',7])?.isInvalidated).toBe(true);expect(createRecharge).toHaveBeenCalledTimes(1);
});
it('刷新到其他路由恢復已知訂單，不重新創建',async()=>{
 saveIntent(7,{tierId:'a',requestId:'restore',orderId:'order-1'});vi.mocked(fetchRechargeOrder).mockResolvedValue({...pending,status:'success'});const notice=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><DepositTracker onSuccess={notice}/></QueryClientProvider>);await waitFor(()=>expect(notice).toHaveBeenCalledTimes(1));expect(createRecharge).not.toHaveBeenCalled();expect(readIntent(7)).toBeNull();
});
