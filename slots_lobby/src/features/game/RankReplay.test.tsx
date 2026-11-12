import {expect,it,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {RankReplay} from './RankReplay';
import {fetchRankReplay} from '../../services/game-statistics';
vi.mock('../../services/game-statistics',()=>({fetchRankReplay:vi.fn()}));
beforeEach(()=>{vi.mocked(fetchRankReplay).mockReset();});
function setup(){render(<QueryClientProvider client={new QueryClient()}><RankReplay betId="GAME-BET-ABC123" orderId="123" board="wins" period="today"/></QueryClientProvider>);}
it('平台訂單號觸發只讀回放請求，彈窗直接加載回放入口',async()=>{
 const url='http://game.example/?replay=game-bet&share='+'s'.repeat(52);vi.mocked(fetchRankReplay).mockResolvedValue(url);setup();expect(screen.getByText('GAME-BET-ABC123')).toBeInTheDocument();expect(screen.getByRole('button',{name:'複製訂單號'})).toBeInTheDocument();expect(screen.queryByText('平台驗證')).not.toBeInTheDocument();expect(screen.queryByText('平台訂單 123')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'回放'}));const frame=await screen.findByTitle('訂單回放');expect(frame).toHaveAttribute('src',url);expect(frame.getAttribute('allow')?.split(';').map(value=>value.trim())).toContain('clipboard-write');expect(fetchRankReplay).toHaveBeenCalledWith('123','wins','today','AG1');
});
it('回放申請失敗保留重試入口',async()=>{vi.mocked(fetchRankReplay).mockRejectedValue(new Error('unavailable'));setup();fireEvent.click(screen.getByRole('button',{name:'回放'}));expect(await screen.findByText('暫無回放，請稍後重試')).toBeInTheDocument();expect(document.querySelector('.game-rank-replay')).not.toHaveTextContent('暫無回放');expect(screen.getByRole('button',{name:'回放'})).toBeEnabled();expect(screen.queryByTitle('訂單回放')).not.toBeInTheDocument();});

it('請求中保留原按鈕文字佔位並阻止重復請求',async()=>{
 vi.mocked(fetchRankReplay).mockImplementation(()=>new Promise(()=>{}));setup();const button=screen.getByRole('button',{name:'回放'});fireEvent.click(button);
 await waitFor(()=>expect(button).toHaveAttribute('aria-busy','true'));expect(button).toHaveTextContent('回放');expect(button).not.toHaveTextContent('正在加載');expect(button).toBeDisabled();fireEvent.click(button);expect(fetchRankReplay).toHaveBeenCalledTimes(1);
});

it('分享提供可複製的回放連結，不開啟播放器',async()=>{
 const url='https://game.example/?replay=game-bet&share='+'s'.repeat(52);
 vi.mocked(fetchRankReplay).mockResolvedValue(url);
 setup();
 fireEvent.click(screen.getByRole('button',{name:'分享'}));
 expect(await screen.findByRole('textbox',{name:'回放連結'})).toHaveValue(url);
 expect(screen.queryByTitle('訂單回放')).not.toBeInTheDocument();
 expect(fetchRankReplay).toHaveBeenCalledWith('123','wins','today','AG1');
});
