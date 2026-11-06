import {beforeEach as authenticatedFixture} from 'vitest';
import {useSessionStore} from '../../stores/session';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { UserSummary } from './UserSummary';
import { loadAccountProfile } from '../../services/account';
vi.mock('../../services/account', () => ({ loadAccountProfile: vi.fn() }));
vi.mock('../../services/recharge', () => ({ fetchRechargeTiers: vi.fn().mockResolvedValue([
  { id: 'a', amount: 1000, bonus: 50, fee: 0, creditAmount: 1050 },
  { id: 'b', amount: 10000, bonus: 300, fee: 0, creditAmount: 10300 },
]) }));
it('取最大贈送比例，刷新中用省略號替換金額，完成後顯示新餘額', async () => {
  const profile = { uid: 7, nickname: 'test', avatarId: 1, coins: 441 };
  let finish: ((value: typeof profile) => void) | undefined;
  vi.mocked(loadAccountProfile).mockResolvedValueOnce(profile).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><UserSummary /></QueryClientProvider>);
  expect(await screen.findByLabelText('金幣餘額 4.41')).toBeInTheDocument();
  expect(await screen.findByText('送5%')).toBeInTheDocument();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: '刷新錢包餘額' }));
  expect(screen.getByRole('status', { name: '正在刷新錢包餘額' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '刷新錢包餘額' })).toBeDisabled();
  expect(screen.queryByLabelText('金幣餘額 4.41')).not.toBeInTheDocument();
  expect(screen.getByText('4.41')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('button', { name: '刷新錢包餘額' })).toHaveAttribute('data-loading', 'true');
  await act(async () => finish?.({ ...profile, coins: 13057751 }));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByRole('status', { name: '正在刷新錢包餘額' })).toBeInTheDocument();
  expect(screen.getByText('4.41')).toHaveAttribute('aria-hidden', 'true');
  await act(async () => { await vi.advanceTimersByTimeAsync(499); });
  expect(screen.getByRole('status', { name: '正在刷新錢包餘額' })).toBeInTheDocument();
  expect(screen.getByText('4.41')).toHaveAttribute('aria-hidden', 'true');
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByLabelText('金幣餘額 130,577.51')).toBeInTheDocument();
  vi.useRealTimers();
  expect(screen.getByRole('button', { name: '刷新錢包餘額' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '前往充值' }));
  expect(window.location.pathname).toBe('/deposit');
  client.clear();
});

authenticatedFixture(()=>useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}}));
