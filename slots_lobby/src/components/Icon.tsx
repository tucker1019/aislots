import type { CSSProperties } from 'react';
const paths = {
  chest: <><path d="M3 11V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v3M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8ZM7 4v7m10-7v7"/><rect x="10" y="10" width="4" height="6" rx="1"/></>,
  home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9Z" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13" /><path d="M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z" /></>,
  wallet: <><path d="M20 8V5a2 2 0 0 0-2-2L5 6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H5" /><path d="M21 12h-5v5h5M17 14.5h.01" /></>,
  growth: <><path d="M3 20h18M5 16v-4M10 16V9M15 16v-5M20 16V6M4 8l6-5 5 3 5-4M17 2h3v3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18m-13 5 3 3 5-5" /></>,
  crown: <><path d="m3 6 5 5 4-8 4 8 5-5-2 13H5L3 6ZM5 22h14" /></>,
  list: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  transfer: <><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" /></>,
  report: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 16v-3M12 16V8M16 16v-5" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01" /></>,
  settings: <><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3H9Z" /><circle cx="12" cy="12" r="3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 7 9-7" /></>,
  refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,

  speaker: <><path d="m11 4-5 4H3v8h3l5 4V4Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
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
