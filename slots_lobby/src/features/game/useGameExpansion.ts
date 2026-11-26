import { useLayoutEffect, useRef, useState } from 'react';

/** Animate the same game surface between its preview and expanded bounds. */
export function useGameExpansion() {
  const [expanded, setExpanded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const previous = useRef<DOMRect | null>(null);
  const animation = useRef<Animation | null>(null);
  const locked = useRef(false);

  function changeExpanded(next: boolean) {
    if (next === expanded || locked.current) return;
    previous.current = surfaceRef.current?.getBoundingClientRect() ?? null;
    locked.current = true;
    setTransitioning(true);
    setExpanded(next);
  }

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const from = previous.current;
    previous.current = null;
    if (!surface || !from) return;
    const to = surface.getBoundingClientRect();
    if (!from.width || !from.height || !to.width || !to.height || !surface.animate) {
      locked.current = false;
      // No animation API in non-visual environments.
      queueMicrotask(() => setTransitioning(false));
      return;
    }
    // Rects are physical pixels; CSS transforms use local coordinates under lobby zoom.
    const zoom = to.width / surface.offsetWidth || 1;
    const running = surface.animate([
      { transform: `translate(${(from.left - to.left) / zoom}px, ${(from.top - to.top) / zoom}px) scale(${from.width / to.width}, ${from.height / to.height})` },
      { transform: 'translate(0, 0) scale(1, 1)' },
    ], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)', transformOrigin: 'top left' } as KeyframeAnimationOptions);
    animation.current = running;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      animation.current = null;
      locked.current = false;
      setTransitioning(false);
    };
    const timer = window.setTimeout(finish, 400);
    running.onfinish = finish;
    return () => {
      window.clearTimeout(timer);
      running.cancel();
      animation.current = null;
      locked.current = false;
      setTransitioning(false);
    };
  }, [expanded]);

  return { expanded, transitioning, surfaceRef, changeExpanded };
}
