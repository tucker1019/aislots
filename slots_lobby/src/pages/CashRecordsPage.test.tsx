import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CashRecordsPage } from './CashRecordsPage';
import { fetchCashRecords } from '../services/cash-records';
import { fetchRechargeOrder } from '../services/recharge';
vi.mock('../features/account/useAccountProfile', () => ({ useAccountProfile: () => ({ data: { uid: 7 }, isPending: false, isError: false }) }));
vi.mock('../services/cash-records', () => ({ fetchCashRecords: vi.fn() }));
vi.mock('../services/recharge', () => ({ fetchRechargeOrder: vi.fn() }));
const row = { orderId: 'order-a', paymentUrl: '', status: 'success' as const, amount: 10000, fee: 0, bonus: 0, creditAmount: 10000, createdAt: '2026-11-03T02:17:28Z' };
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, '', '/records'); });
function setup(orderId?: string) {
  const onBack = vi.fn(), comingSoon = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><CashRecordsPage orderId={orderId} onBack={onBack} onComingSoon={comingSoon} /></QueryClientProvider>);
  return { user: userEvent.setup(), onBack, comingSoon };
}
it('空態與篩選：取款按類型查詢，時間篩選發出不同的服務端範圍', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  const { user } = setup();
  expect(await screen.findByLabelText('暫無數據')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '全部' }));
  await user.click(screen.getByRole('button', { name: '取款' }));
  await waitFor(() => expect(fetchCashRecords).toHaveBeenCalledTimes(2));
  expect(vi.mocked(fetchCashRecords).mock.calls[1][3]).toBe('withdrawal');
  await user.click(screen.getByRole('button', { name: '今天' }));
  await user.click(screen.getByRole('button', { name: '昨天' }));
  await waitFor(() => expect(fetchCashRecords).toHaveBeenCalledTimes(3));
  expect(vi.mocked(fetchCashRecords).mock.calls[1][0]).not.toEqual(vi.mocked(fetchCashRecords).mock.calls[2][0]);
  expect(screen.queryByLabelText('記錄時間')).not.toBeInTheDocument();
});
it('加載更多保留已看記錄，第二頁失敗可重試，行點擊進入詳情地址', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValueOnce({ items: [row], nextCursor: 'next' }).mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [{ ...row, orderId: 'order-b' }], nextCursor: '' });
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: '加載更多' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('加載更多失敗');
  expect(screen.getAllByRole('button', { name: /查看存款/ })).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '重試加載更多' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: /查看存款/ })).toHaveLength(2));
  await user.click(screen.getAllByRole('button', { name: /查看存款/ })[0]);
  expect(window.location.search).toBe('?orderId=order-a');
});
it('列表失敗提供重試，不能顯示成空記錄', async () => {
  vi.mocked(fetchCashRecords).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [], nextCursor: '' });
  const { user } = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('網絡異常，請重試');
  expect(screen.queryByLabelText('暫無數據')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '重試' }));
  expect(await screen.findByLabelText('暫無數據')).toBeInTheDocument();
});
it('詳情展示真實費用到賬與測試支付，可複製訂單號；失敗訂單不展示已到賬金額', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  vi.mocked(fetchRechargeOrder).mockResolvedValue({ ...row, fee: 20, creditAmount: 9980 });
  const { user } = setup('order-a');
  expect(await screen.findByText('99.80')).toBeInTheDocument();
  expect(screen.getByText('測試支付')).toBeInTheDocument();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await user.click(screen.getByRole('button', { name: '複製' }));
  expect(await screen.findByRole('button', { name: '已複製' })).toBeInTheDocument();
  expect(write).toHaveBeenCalledWith('order-a');
});
it('篩選支持Escape收起，不改動當前選擇', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '今天' }));
  act(() => fireEvent.keyDown(screen.getByRole('button', { name: '近30天' }), { key: 'Escape' }));
  expect(screen.queryByLabelText('記錄時間')).not.toBeInTheDocument();
});
it('失敗訂單顯示實際到賬0，不將配置中的預計到賬當作已入賬', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  vi.mocked(fetchRechargeOrder).mockResolvedValue({ ...row, status: 'failed', fee: 20, creditAmount: 9980 });
  setup('order-a');
  expect(await screen.findByText('交易失敗')).toBeInTheDocument();
  expect(screen.getByText('實際到賬').parentElement).toHaveTextContent('0.00');
  expect(screen.queryByText('99.80')).not.toBeInTheDocument();
});
