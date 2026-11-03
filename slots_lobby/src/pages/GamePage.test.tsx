import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as GameEntryModule from '../services/game-entry';
import { GamePage } from './GamePage';
import { launchGame, rememberGameEntry } from '../services/game-entry';
vi.mock('../services/game-entry', async original => ({ ...await original<typeof GameEntryModule>(), launchGame: vi.fn() }));
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
it('没有入口时可重新申请，失败可重试，成功更新iframe', async () => {
  const { user } = setup();
  vi.mocked(launchGame).mockRejectedValueOnce(new Error('服务暂时不可用')).mockResolvedValueOnce(first);
  await user.click(screen.getByRole('button', { name: '重新进入' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('服务暂时不可用');
  await user.click(screen.getByRole('button', { name: '重新进入' }));
  await waitFor(() => expect(screen.getByTitle('AG1 麻将胡了')).toHaveAttribute('src', first));
});
