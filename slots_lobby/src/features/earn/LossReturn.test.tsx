import {beforeEach as authenticatedFixture} from 'vitest';
import {useSessionStore} from '../../stores/session';
import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {LossReturn} from './LossReturn';
import {fetchLossReturn,claimLossReturn} from '../../services/loss-return';
vi.mock('../../services/loss-return',()=>({fetchLossReturn:vi.fn(),claimLossReturn:vi.fn()}));
beforeEach(()=>{vi.mocked(fetchLossReturn).mockReset();vi.mocked(claimLossReturn).mockReset();});
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><LossReturn/></QueryClientProvider>);return userEvent.setup();}
const data={activityDate:'2026-11-04',timezone:'Asia/Shanghai',claimable:100,loss:10000,reward:1000,rateBps:1000};
it('shows server loss and preview; claims the current activity day once and clears claimable',async()=>{
 vi.mocked(fetchLossReturn).mockResolvedValue(data);vi.mocked(claimLossReturn).mockResolvedValue(100);const user=setup();
 expect(await screen.findByText('100.00')).toBeInTheDocument();expect(screen.getByText('10%')).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:/^領取$/}));expect(await screen.findByText('領取成功')).toBeInTheDocument();expect(claimLossReturn).toHaveBeenCalledExactlyOnceWith('2026-11-04',expect.anything());expect(screen.getByRole('button',{name:/^領取$/})).toBeDisabled();
});
it('retries failed data without claiming and navigates to the rules',async()=>{
 vi.mocked(fetchLossReturn).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(data);const user=setup();await user.click(await screen.findByRole('button',{name:'重試'}));expect(await screen.findByText('100.00')).toBeInTheDocument();expect(claimLossReturn).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'規則查看 ›'}));expect(window.location.pathname).toBe('/earn/loss-return/rules');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

authenticatedFixture(()=>useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}}));
