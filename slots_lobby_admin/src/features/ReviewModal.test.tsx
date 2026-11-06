import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewModal } from './ReviewModal';
import type { Order } from '../services/admin';
import * as admin from '../services/admin';
beforeAll(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; const compute = window.getComputedStyle; window.getComputedStyle = element => compute(element); Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const order: Order = { orderId: 'order-101', uid: 'member-5', kind: 'withdrawal', status: 'pending', amount: '5000', fee: '20', bonus: '0', creditAmount: '4980', channel: 'BANK', account: '***12', name: '张*', createdAt: '', settledAt: '' };
function mount(close = vi.fn()) { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><ReviewModal order={order} close={close} /></QueryClientProvider>); }
describe('explicit financial review confirmation', () => {
 it('opening modal and entering reason never sends review; requires confirm', async () => {
  let finish: ((result: { orderId: string; status: string }) => void) | undefined;
  const service = vi.spyOn(admin, 'reviewOrder').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const close = vi.fn(); mount(close);
  const confirm = screen.getByRole('button', { name: '确认审核' });
  expect(confirm.hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText('审核理由（必填，至少 2 字）'), { target: { value: '收款信息已核实' } });
  expect(service).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await waitFor(() => expect(service).toHaveBeenCalledTimes(1));
  fireEvent.click(confirm);
  expect(service).toHaveBeenCalledTimes(1);
  expect(confirm.getAttribute('aria-busy')).toBe('true');
  expect(service.mock.calls[0][0]).toMatchObject({ orderId: 'order-101', kind: 'withdrawal', decision: 'approve', reason: '收款信息已核实' });
  finish?.({ orderId: 'order-101', status: 'approved' });
  await waitFor(() => expect(close).toHaveBeenCalled());
 });
 it('preserves idempotency key when retrying an unchanged failed review', async () => {
  const service = vi.spyOn(admin, 'reviewOrder').mockRejectedValue(new Error('模拟网络中断')); mount();
  fireEvent.change(screen.getByLabelText('审核理由（必填，至少 2 字）'), { target: { value: '核实订单' } });
  fireEvent.click(screen.getByRole('button', { name: '确认审核' }));
  await screen.findByText('模拟网络中断');
  fireEvent.click(screen.getByRole('button', { name: '确认审核' }));
  await waitFor(() => expect(service).toHaveBeenCalledTimes(2));
  expect(service.mock.calls[0][0].requestId).toBe(service.mock.calls[1][0].requestId);
 });
});
