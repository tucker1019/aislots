import { useLayoutEffect, useRef } from 'react';

export function NavigationIndicator({ selected }: { selected: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const indicator = ref.current;
    const nav = indicator?.parentElement;
    const active = nav?.querySelector<HTMLButtonElement>('button[aria-pressed="true"], button[aria-current="page"]');
    if (!indicator || !nav || !active) return;

    const align = () => {
      const center = active.offsetLeft + active.offsetWidth / 2;
      indicator.style.transform = `translateX(calc(${center}px - 50%))`;
      indicator.style.visibility = 'visible';
    };

    indicator.toggleAttribute('data-animate', Boolean(indicator.style.transform));
    align();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(align);
    observer.observe(nav);
    nav.querySelectorAll('button').forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [selected]);

  return <span ref={ref} className="navigation-indicator" aria-hidden="true" />;
}
