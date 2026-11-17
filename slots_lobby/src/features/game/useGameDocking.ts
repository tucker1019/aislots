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
    const zoom = from.width / shell.offsetWidth || 1;
    const full = 'translateX(-50%) translate(0, 0) scale(1, 1)';
    const scale = Math.min(to.width / from.width, to.height / from.height);
    const left = to.left + (to.width - from.width * scale) / 2;
    const top = to.top + (to.height - from.height * scale) / 2;
    const docked = `translateX(-50%) translate(${(left - from.left) / zoom}px, ${(top - from.top) / zoom}px) scale(${scale}, ${scale})`;
    const restore = target.querySelector<HTMLButtonElement>('.minimized-game-restore');
    if (restore) restore.disabled = true;
    shell.classList.add('game-detail-docking');
    shell.inert = true;
    const animation = shell.animate(
      [{ transform: minimized ? full : docked, opacity: minimized ? 1 : 0, borderRadius: minimized ? '0px' : '13px' },
       { transform: minimized ? docked : full, opacity: minimized ? 0 : 1, borderRadius: minimized ? '13px' : '0px' }],
      { duration: 500, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' },
    );
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
