import {expect,it,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {RankReplay} from './RankReplay';
import {fetchRankReplay} from '../../services/game-statistics';
vi.mock('../../services/game-statistics',()=>({fetchRankReplay:vi.fn()}));
beforeEach(()=>{vi.mocked(fetchRankReplay).mockReset();});
function setup(){render(<QueryClientProvider client={new QueryClient()}><RankReplay betId="GAME-BET-ABC123" orderId="123" board="wins" period="today"/></QueryClientProvider>);}
it('平台订单号触发只读回放请求，弹窗直接加载回放入口',async()=>{
 const url='http://game.example/?replay=game-bet&share='+'s'.repeat(52);vi.mocked(fetchRankReplay).mockResolvedValue(url);setup();expect(screen.getByText('订单 GAME-BET-ABC123')).toBeInTheDocument();expect(screen.getByLabelText('平台验证')).toBeInTheDocument();expect(screen.queryByText('平台订单 123')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'回放'}));const frame=await screen.findByTitle('订单回放');expect(frame).toHaveAttribute('src',url);expect(frame.getAttribute('allow')?.split(';').map(value=>value.trim())).toContain('clipboard-write');expect(fetchRankReplay).toHaveBeenCalledWith('123','wins','today');
});
it('回放申请失败保留重试入口',async()=>{vi.mocked(fetchRankReplay).mockRejectedValue(new Error('unavailable'));setup();fireEvent.click(screen.getByRole('button',{name:'回放'}));expect(await screen.findByRole('alert')).toHaveTextContent('暂无回放');expect(screen.getByRole('button',{name:'回放'})).toBeEnabled();expect(screen.queryByTitle('订单回放')).not.toBeInTheDocument();});

it('请求中保留原按钮文字占位并阻止重复请求',async()=>{
 vi.mocked(fetchRankReplay).mockImplementation(()=>new Promise(()=>{}));setup();const button=screen.getByRole('button',{name:'回放'});fireEvent.click(button);
 await waitFor(()=>expect(button).toHaveAttribute('aria-busy','true'));expect(button).toHaveTextContent('回放');expect(button).not.toHaveTextContent('正在加载');expect(button).toBeDisabled();fireEvent.click(button);expect(fetchRankReplay).toHaveBeenCalledTimes(1);
});
