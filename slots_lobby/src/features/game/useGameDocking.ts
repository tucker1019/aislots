import { gamePageFrames, gamePageMotionOptions } from './gamePageMotion';
import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Move the existing detail shell into the persistent dock without remounting its iframe. */
export function useGameDocking(minimized: boolean, targetRef?: RefObject<HTMLElement | null>) {
  const shellRef = useRef<HTMLElement>(null);
  const previous = useRef(minimized);

  useLayoutEffect(() => {
    const changed = previous.current !== minimized;
    previous.current = minimized;
    const shell = shellRef.current;
    const target = targetRef?.current;
    if (!changed || !shell || !target || !shell.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const from = shell.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.width || !from.height || !to.width || !to.height) return;
    const restore = target.querySelector<HTMLButtonElement>('.minimized-game-restore');
    if (restore) restore.disabled = true;
    shell.classList.add('game-detail-docking');
    shell.inert = true;
    const animation = shell.animate(gamePageFrames(shell, to, minimized), gamePageMotionOptions);
    const finish = () => {
      shell.classList.remove('game-detail-docking');
      shell.inert = minimized;
      if (restore) restore.disabled = false;
      animation.cancel();
    };
    animation.onfinish = finish;
    return finish;
  }, [minimized, targetRef]);

  return shellRef;
}
