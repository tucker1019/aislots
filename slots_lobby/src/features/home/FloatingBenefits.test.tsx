import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FloatingBenefits } from './FloatingBenefits';
import { useLanguageStore } from '../../i18n';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../../app/useLobbyRoute', () => ({ navigateLobby: navigate }));
afterEach(() => { cleanup(); navigate.mockClear(); });

it.each([
  ['zh-TW', '福利中心', '關閉福利中心入口'],
  ['en-US', 'Benefits', 'Close benefits shortcut'],
  ['id-ID', 'Bonus', 'Tutup pintasan bonus'],
] as const)('supports %s and opens benefits', (locale, label, close) => {
  useLanguageStore.getState().setLocale(locale);
  render(<FloatingBenefits />);
  fireEvent.click(screen.getByText(label));
  expect(navigate).toHaveBeenCalledWith('benefits');
  fireEvent.click(screen.getByRole('button', { name: close }));
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  expect(navigate).toHaveBeenCalledTimes(1);
});
