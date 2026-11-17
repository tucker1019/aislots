import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { gameCardOrigin } from './gameCardOrigin';
import { gamePageFrames, gamePageMotionOptions } from './gamePageMotion';

export function useGameCardTransition(gameId: string, shellRef: RefObject<HTMLElement | null>) {
  const [opening, setOpening] = useState(true);
  const running = useRef<Animation | null>(null);
  const closing = useRef(false);
  const animate = useCallback((shrinking: boolean, done: () => void) => {
    const shell = shellRef.current;
    if (!shell || !shell.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    shell.classList.add('game-detail-docking');
    shell.inert = true;
    const animation = shell.animate(gamePageFrames(shell, gameCardOrigin(gameId), shrinking), gamePageMotionOptions);
    running.current = animation;
    animation.onfinish = () => {
      running.current = null;
      // Keep the last exit frame applied until React removes the page.
      if (!shrinking) {
        shell.classList.remove('game-detail-docking');
        shell.inert = false;
        animation.cancel();
      }
      done();
    };
  }, [gameId, shellRef]);
  useLayoutEffect(() => {
    const shell = shellRef.current;
    animate(false, () => setOpening(false));
    return () => {
      running.current?.cancel();
      running.current = null;
      shell?.classList.remove('game-detail-docking');
    };
  }, [animate, shellRef]);
  const closeToCard = useCallback((done: () => void) => {
    if (closing.current || running.current) return;
    closing.current = true;
    animate(true, done);
  }, [animate]);
  return { opening, closeToCard };
}
