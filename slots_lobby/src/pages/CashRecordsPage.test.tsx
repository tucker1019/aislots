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
it('空态与筛选：取款按类型查询，时间筛选发出不同的服务端范围', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  const { user } = setup();
  expect(await screen.findByLabelText('暂无数据')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '全部' }));
  await user.click(screen.getByRole('button', { name: '取款' }));
  await waitFor(() => expect(fetchCashRecords).toHaveBeenCalledTimes(2));
  expect(vi.mocked(fetchCashRecords).mock.calls[1][3]).toBe('withdrawal');
  await user.click(screen.getByRole('button', { name: '今天' }));
  await user.click(screen.getByRole('button', { name: '昨天' }));
  await waitFor(() => expect(fetchCashRecords).toHaveBeenCalledTimes(3));
  expect(vi.mocked(fetchCashRecords).mock.calls[1][0]).not.toEqual(vi.mocked(fetchCashRecords).mock.calls[2][0]);
  expect(screen.queryByLabelText('记录时间')).not.toBeInTheDocument();
});
it('加载更多保留已看记录，第二页失败可重试，行点击进入详情地址', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValueOnce({ items: [row], nextCursor: 'next' }).mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [{ ...row, orderId: 'order-b' }], nextCursor: '' });
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: '加载更多' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('加载更多失败');
  expect(screen.getAllByRole('button', { name: /查看存款/ })).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '重试加载更多' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: /查看存款/ })).toHaveLength(2));
  await user.click(screen.getAllByRole('button', { name: /查看存款/ })[0]);
  expect(window.location.search).toBe('?orderId=order-a');
});
it('列表失败提供重试，不能显示成空记录', async () => {
  vi.mocked(fetchCashRecords).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [], nextCursor: '' });
  const { user } = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('网络异常，请重试');
  expect(screen.queryByLabelText('暂无数据')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByLabelText('暂无数据')).toBeInTheDocument();
});
it('详情展示真实费用到账与测试支付，可复制订单号；失败订单不展示已到账金额', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  vi.mocked(fetchRechargeOrder).mockResolvedValue({ ...row, fee: 20, creditAmount: 9980 });
  const { user } = setup('order-a');
  expect(await screen.findByText('99.80')).toBeInTheDocument();
  expect(screen.getByText('测试支付')).toBeInTheDocument();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await user.click(screen.getByRole('button', { name: '复制' }));
  expect(await screen.findByRole('button', { name: '已复制' })).toBeInTheDocument();
  expect(write).toHaveBeenCalledWith('order-a');
});
it('筛选支持Escape收起，不改动当前选择', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '今天' }));
  act(() => fireEvent.keyDown(screen.getByRole('button', { name: '近30天' }), { key: 'Escape' }));
  expect(screen.queryByLabelText('记录时间')).not.toBeInTheDocument();
});
it('失败订单显示实际到账0，不将配置中的预计到账当作已入账', async () => {
  vi.mocked(fetchCashRecords).mockResolvedValue({ items: [], nextCursor: '' });
  vi.mocked(fetchRechargeOrder).mockResolvedValue({ ...row, status: 'failed', fee: 20, creditAmount: 9980 });
  setup('order-a');
  expect(await screen.findByText('交易失败')).toBeInTheDocument();
  expect(screen.getByText('实际到账').parentElement).toHaveTextContent('0.00');
  expect(screen.queryByText('99.80')).not.toBeInTheDocument();
});
