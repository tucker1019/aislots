import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGameExpansion } from './useGameExpansion';

function Harness() {
  const { expanded, transitioning, surfaceRef, changeExpanded } = useGameExpansion();
  return <><button onClick={() => changeExpanded(!expanded)}>toggle</button><div ref={surfaceRef} data-expanded={expanded} data-transitioning={transitioning}><iframe title="game" src="about:blank" /></div></>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('animates both directions for 300ms without replacing the game or accepting repeat clicks', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 100, width: 300, height: 250 } as DOMRect);
  const running = { cancel: vi.fn(), onfinish: null as (() => void) | null };
  const animate = vi.fn(() => running);
  vi.stubGlobal('Animation', class {});
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  render(<Harness />);
  const frame = screen.getByTitle('game');
  fireEvent.click(screen.getByText('toggle'));
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.calls[0]).toBeDefined();
  fireEvent.click(screen.getByText('toggle'));
  expect(animate).toHaveBeenCalledTimes(1);
  act(() => running.onfinish?.());
  fireEvent.click(screen.getByText('toggle'));
  expect(animate).toHaveBeenCalledTimes(2);
  expect(screen.getByTitle('game')).toBe(frame);
  expect(frame.parentElement).toHaveAttribute('data-expanded', 'false');
  expect(animate).toHaveBeenLastCalledWith(expect.any(Array), expect.objectContaining({ duration: 300 }));
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
  vi.unstubAllGlobals();
});
