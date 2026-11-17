import { afterEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeSelector } from './ThemeSelector';
import { useThemeStore } from '../../stores/theme';
afterEach(() => { localStorage.removeItem('aislots-theme'); });
it('hides the theme selector', () => {
  const { container } = render(<ThemeSelector />);
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole('button', { name: '切換主題' })).not.toBeInTheDocument();
});
it('keeps dark mode even with a saved light preference or a stale light-mode action', () => {
  localStorage.setItem('aislots-theme', 'light');
  useThemeStore.getState().setTheme('light');
  expect(useThemeStore.getState().mode).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('aislots-theme')).toBe('dark');
});
