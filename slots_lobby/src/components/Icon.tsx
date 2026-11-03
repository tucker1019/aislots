import type { CSSProperties } from 'react';
const paths = {
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 7.5h-4a2.2 2.2 0 0 0 0 4.5h3a2.2 2.2 0 0 1 0 4.5h-4M12 5.5v13" /></>,
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
