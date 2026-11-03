import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useAccountProfile } from './useAccountProfile';
import { loadAccountProfile } from '../../services/account';
vi.mock('../../services/account', () => ({ loadAccountProfile: vi.fn() }));
function Probe() { const query = useAccountProfile(); return <output>{query.data?.coins}</output>; }
it('从游戏返回浏览器缓存页时立即刷新余额，不等待资料缓存过期', async () => {
  const account = { uid: 1, nickname: '用户', avatarId: 1, coins: 1000 };
  vi.mocked(loadAccountProfile).mockResolvedValueOnce(account).mockResolvedValueOnce({ ...account, coins: 920 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  expect(await screen.findByText('1000')).toBeInTheDocument();
  act(() => { window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); });
  await waitFor(() => expect(screen.getByText('920')).toBeInTheDocument());
  expect(loadAccountProfile).toHaveBeenCalledTimes(2);
});
