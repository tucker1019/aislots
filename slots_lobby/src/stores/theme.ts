import { create } from 'zustand';
export type ThemeMode = 'light' | 'dark';

function applyDarkTheme() {
  document.documentElement.dataset.theme = 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#102c2b');
  try { localStorage.setItem('aislots-theme', 'dark'); } catch { /* Dark mode also works without storage. */ }
}

applyDarkTheme();
export const useThemeStore = create<{ mode: ThemeMode; setTheme: (mode: ThemeMode) => void }>(set => ({
  mode: 'dark',
  setTheme: () => { applyDarkTheme(); set({ mode: 'dark' }); },
}));
