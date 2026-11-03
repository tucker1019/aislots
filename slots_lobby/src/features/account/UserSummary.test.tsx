import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserSummary } from './UserSummary';
import { loadAccountProfile } from '../../services/account';
vi.mock('../../services/account', () => ({ loadAccountProfile: vi.fn() }));
beforeEach(() => { vi.mocked(loadAccountProfile).mockReset(); });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><UserSummary /></QueryClientProvider>);
  return userEvent.setup();
}
it('真实分余额按两位小数展示，使用服务端头像编号', async () => {
  vi.mocked(loadAccountProfile).mockResolvedValue({ uid: 7, nickname: '小明', coins: 123456, avatarId: 3 });
  setup();
  expect(await screen.findByLabelText('金币余额 1,234.56')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '小明的头像' })).toHaveAttribute('src', '/assets/profile/avatar/3.png');
});
it('加载失败展示重试，成功的0余额明确显示为0.00', async () => {
  vi.mocked(loadAccountProfile).mockRejectedValueOnce(new Error('暂时无法连接大厅服务，请重试'))
    .mockResolvedValueOnce({ uid: 7, nickname: '小明', coins: 0, avatarId: 1 });
  const user = setup();
  await user.click(await screen.findByRole('button', { name: '重新加载用户资料' }));
  expect(await screen.findByLabelText('金币余额 0.00')).toBeInTheDocument();
});
it('加载中不显示虚构余额', () => {
  vi.mocked(loadAccountProfile).mockReturnValue(new Promise(() => undefined));
  setup();
  expect(screen.getByRole('status', { name: '正在加载用户资料' })).toBeInTheDocument();
  expect(screen.queryByLabelText('金币余额 0.00')).not.toBeInTheDocument();
});

it('首页头像进入我的，金额框进入充值', async () => {
  window.history.replaceState({},'', '/');
  vi.mocked(loadAccountProfile).mockResolvedValue({uid:7,nickname:'小明',coins:100,avatarId:1});
  const user=setup();await screen.findByLabelText('金币余额 1.00');
  await user.click(screen.getByRole('button',{name:'前往我的'}));expect(window.location.pathname).toBe('/my');
  await user.click(screen.getByRole('button',{name:'前往充值'}));expect(window.location.pathname).toBe('/deposit');
});
