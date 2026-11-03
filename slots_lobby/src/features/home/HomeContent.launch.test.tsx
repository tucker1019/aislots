import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeContent } from './HomeContent';
import { launchGame } from '../../services/game-entry';
vi.mock('../../services/game-entry', () => ({ launchGame: vi.fn(), rememberGameEntry: vi.fn() }));
it('进入期间防重复，失败后显示错误并允许重新申请入口', async () => {
  let reject: (error: Error) => void = () => undefined;
  vi.mocked(launchGame).mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  const onToast = vi.fn(); const user = userEvent.setup();
  render(<HomeContent onToast={onToast} />);
  await user.click(screen.getByRole('button', { name: '进入麻将胡了' }));
  const pending = screen.getByRole('button', { name: '正在进入麻将胡了' });
  expect(pending).toBeDisabled(); await user.click(pending);
  expect(launchGame).toHaveBeenCalledTimes(1);
  reject(new Error('无法连接游戏服务'));
  expect(await screen.findByRole('button', { name: '进入麻将胡了' })).toBeEnabled();
  expect(onToast).toHaveBeenCalledWith('无法连接游戏服务');
});
