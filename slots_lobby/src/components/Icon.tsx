import type { CSSProperties } from 'react';
const paths = {
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 7.5h-4a2.2 2.2 0 0 0 0 4.5h3a2.2 2.2 0 0 1 0 4.5h-4M12 5.5v13" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  heart: <path d="M20.7 5.7a5.2 5.2 0 0 0-7.4 0L12 7l-1.3-1.3a5.2 5.2 0 0 0-7.4 7.4L12 22l8.7-8.9a5.2 5.2 0 0 0 0-7.4Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6.5V12l3.8 2.2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, filled = false, style }: {
  name: IconName; size?: number; filled?: boolean; style?: CSSProperties;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
    {paths[name]}
  </svg>;
}
