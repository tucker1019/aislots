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
it('同一大厅内iframe加载游戏，刷新恢复原入口，返回前使钱包缓存过期', async () => {
  rememberGameEntry(first); const { onBack, client, user } = setup();
  const frame = screen.getByTitle('AG1 麻将胡了');
  expect(frame).toHaveAttribute('src', first);
  expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(screen.getByText('正在加载游戏…')).toBeInTheDocument();
  fireEvent.load(frame);
  expect(screen.queryByText('正在加载游戏…')).not.toBeInTheDocument();
  expect(client.getQueryState(['lobby', 'current-profile'])?.isInvalidated).toBe(true);
  expect(launchGame).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '返回大厅' }));
  expect(onBack).toHaveBeenCalledOnce();
});
it('详情打开时申请入口，失败后可重试', async () => {
 vi.mocked(launchGame).mockRejectedValueOnce(new Error('服务暂时不可用')).mockResolvedValueOnce(first);
 const {user}=setup();
 expect(await screen.findByRole('alert')).toHaveTextContent('服务暂时不可用');
 await user.click(screen.getByRole('button',{name:'重试加载'}));
 await waitFor(()=>expect(screen.getByTitle('AG1 麻将胡了')).toHaveAttribute('src',first));
 expect(launchGame).toHaveBeenCalledTimes(2);
});
it('放大和缩回保留同一个iframe节点和src，不再申请入口',async()=>{
 rememberGameEntry(first);const {user}=setup();const frame=screen.getByTitle('AG1 麻将胡了');
 await user.click(screen.getByRole('button',{name:/放大游玩/}));expect(screen.getByRole('dialog')).toHaveClass('game-detail-expanded');expect(screen.getByTitle('AG1 麻将胡了')).toBe(frame);
 await user.click(screen.getByRole('button',{name:'缩回小窗'}));expect(screen.getByRole('dialog')).not.toHaveClass('game-detail-expanded');expect(screen.getByTitle('AG1 麻将胡了')).toBe(frame);expect(frame).toHaveAttribute('src',first);expect(launchGame).not.toHaveBeenCalled();
 expect(screen.getByRole('tab',{name:'最大连胜'})).toBeInTheDocument();await user.click(screen.getByRole('tab',{name:'最大连胜'}));expect(await screen.findByText('暂无上榜记录')).toBeInTheDocument();
});
