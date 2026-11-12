import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigNavigation } from '../features/ConfigNavigation';
import { useConsole } from '../features/session';
import { Configs } from './Configs';
import { getConfig } from '../services/configs';

vi.mock('../services/configs', () => ({
 getConfigs: vi.fn().mockResolvedValue([
  { key: 'content', label: '公告与轮播', description: '', hasDraft: false, publishedVersion: 1 },
  { key: 'deposit', label: '存款档位', description: '', hasDraft: true, publishedVersion: 2 },
 ]),
 getConfig: vi.fn(async (key: string) => ({ key, label: key })),
}));
vi.mock('../features/ConfigEditor', () => ({
 ConfigEditor: ({ config }: { config: { key: string } }) => <div data-testid="selected-editor">{config.key}</div>,
}));
beforeEach(() => useConsole.setState({ screen: 'configs', configKey: '' }));
afterEach(cleanup);
function fixture() {
 render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <ConfigNavigation /><Configs />
 </QueryClientProvider>);
}
it('opens the default config and switches the editor from sidebar children', async () => {
 fixture();
 expect((await screen.findByTestId('selected-editor')).textContent).toBe('content');
 const menu = screen.getByLabelText('大厅配置子菜单');
 fireEvent.click(within(menu).getByRole('button', { name: /存款档位/ }));
 expect((await screen.findByText('deposit', { selector: '[data-testid="selected-editor"]' })).textContent).toBe('deposit');
 expect(useConsole.getState()).toMatchObject({ screen: 'configs', configKey: 'deposit' });
 expect(within(menu).getByRole('button', { name: /存款档位/ }).getAttribute('aria-current')).toBe('page');
 expect(screen.queryByRole('navigation', { name: '配置分区' })).toBeNull();
});
it('keeps the selected section when returning and falls back for a missing section', async () => {
 useConsole.setState({ configKey: 'deposit' });
 fixture();
 expect((await screen.findByTestId('selected-editor')).textContent).toBe('deposit');
 cleanup();
 useConsole.setState({ configKey: 'removed-config' });
 fixture();
 expect((await screen.findByTestId('selected-editor')).textContent).toBe('content');
 expect(getConfig).not.toHaveBeenCalledWith('removed-config');
});
