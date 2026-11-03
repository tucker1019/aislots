import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LobbyPage } from './LobbyPage';
vi.mock('../services/account', () => ({ loadAccountProfile: vi.fn().mockResolvedValue({ uid: 7, nickname: '测试用户', avatarId: 1, coins: 12345 }) }));
it('保留真实资料顶栏，其余大厅内容清空等待重新开发', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><LobbyPage /></QueryClientProvider>);
  expect(await screen.findByLabelText('金币余额 123.45')).toBeInTheDocument();
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('main')).toBeEmptyDOMElement();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
