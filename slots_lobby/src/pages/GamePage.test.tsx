import type * as StatisticsModule from '../services/game-statistics';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as GameEntryModule from '../services/game-entry';
import { GamePage } from './GamePage';
import { launchGame, rememberGameEntry } from '../services/game-entry';
vi.mock('../services/game-entry', async original => ({ ...await original<typeof GameEntryModule>(), launchGame: vi.fn() }));
vi.mock('../services/game-statistics',async original=>({...await original<typeof StatisticsModule>(),fetchGameRtp:vi.fn().mockResolvedValue({percent:'0',rounds:0,hasData:false,from:'2026-11-03T00:00:00Z',to:'2026-11-03T01:00:00Z',updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z'}),fetchLeaderboard:vi.fn().mockResolvedValue({items:[],updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z',timezone:'UTC'})}));
const first = 'http://127.0.0.1:5180/?launchTicket=' + 'A'.repeat(52);
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
function setup() {
  const onBack = vi.fn(); const client = new QueryClient();
  client.setQueryData(['lobby', 'current-profile'], { coins: 100 });
  render(<QueryClientProvider client={client}><GamePage onBack={onBack} /></QueryClientProvider>);
  return { onBack, client, user: userEvent.setup() };
}
it('同一大廳內iframe加載遊戲，刷新恢復原入口，返回前使錢包緩存過期', async () => {
  rememberGameEntry(first); const { onBack, client, user } = setup();
  const frame = screen.getByTitle('AG1 麻將胡了');
  expect(frame).toHaveAttribute('src', first);
  expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(screen.queryByText('正在加載遊戲…')).not.toBeInTheDocument();
  fireEvent.load(frame);
  expect(screen.queryByText('正在加載遊戲…')).not.toBeInTheDocument();
  expect(client.getQueryState(['lobby', 'current-profile'])?.isInvalidated).toBe(true);
  expect(launchGame).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '返回大廳' }));
  expect(onBack).toHaveBeenCalledOnce();
});
it('詳情打開時申請入口，失敗後可重試', async () => {
 vi.mocked(launchGame).mockRejectedValueOnce(new Error('服務暫時不可用')).mockResolvedValueOnce(first);
 const {user}=setup();
 expect(await screen.findByRole('alert')).toHaveTextContent('服務暫時不可用');
 await user.click(screen.getByRole('button',{name:'重試加載'}));
 await waitFor(()=>expect(screen.getByTitle('AG1 麻將胡了')).toHaveAttribute('src',first));
 expect(launchGame).toHaveBeenCalledTimes(2);
});
it('放大和縮回保留同一個iframe節點和src，不再申請入口',async()=>{
 rememberGameEntry(first);const {user}=setup();const frame=screen.getByTitle('AG1 麻將胡了');
 await user.click(screen.getByRole('button',{name:/放大遊玩/}));expect(screen.getByRole('dialog')).toHaveClass('game-detail-expanded');expect(screen.getByTitle('AG1 麻將胡了')).toBe(frame);
 expect(screen.queryByRole('button',{name:'重新進入'})).not.toBeInTheDocument();
 const menu=screen.getByRole('button',{name:'開啟遊戲選單'});
 const shell=screen.getByRole('dialog');
 vi.spyOn(shell,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,420,800));
 vi.spyOn(menu,'getBoundingClientRect').mockReturnValue(new DOMRect(356,10,54,54));
 const pointer=(type:string,x:number,y:number)=>fireEvent(menu,Object.assign(new MouseEvent(type,{
  bubbles:true,button:0,clientX:x,clientY:y,
 }),{pointerId:1,isPrimary:true}));
 pointer('pointerdown',380,35);
 pointer('pointermove',120,230);
 pointer('pointerup',120,230);
 fireEvent.click(menu,{detail:1});
 expect(menu.parentElement?.style.top).toContain('205px');
 expect(menu).toHaveAttribute('aria-expanded','false');
 await user.click(menu);
 expect(screen.getByRole('button',{name:'退出遊戲'})).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'縮回小窗'}));expect(screen.getByRole('dialog')).not.toHaveClass('game-detail-expanded');expect(screen.getByTitle('AG1 麻將胡了')).toBe(frame);expect(frame).toHaveAttribute('src',first);expect(launchGame).not.toHaveBeenCalled();
 expect(screen.getByRole('tab',{name:'最大連勝'})).toBeInTheDocument();await user.click(screen.getByRole('tab',{name:'最大連勝'}));expect(await screen.findByText('暫無上榜記錄')).toBeInTheDocument();
});
