import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { useLanguageStore } from '../i18n';
// Business view tests explicitly use Traditional Chinese; production defaults to Indonesian.
beforeEach(() => useLanguageStore.setState({ locale: 'zh-TW' }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({ matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(),
    removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
});
class TestResizeObserver {
  observe() { /* jsdom has no layout engine. */ }
  unobserve() { /* no subscription */ }
  disconnect() { /* no subscription */ }
}
globalThis.ResizeObserver = TestResizeObserver;
window.scrollTo = vi.fn();
HTMLElement.prototype.scrollIntoView = vi.fn();
