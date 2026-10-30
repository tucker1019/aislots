import { useState, type ComponentProps } from 'react';

type Props = Omit<ComponentProps<'details'>, 'open' | 'onToggle'> & { storageId: string; defaultOpen?: boolean };
/** Each disclosure keeps its own state, including children of collapsed menus. */
export function PersistentDetails({ storageId, defaultOpen = false, ...props }: Props) {
  const key = `slot-math.menu.${storageId}`;
  const [open, setOpen] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved === 'true' ? true : saved === 'false' ? false : defaultOpen; }
    catch { return defaultOpen; }
  });
  return <details {...props} open={open} onToggle={event => {
    const next = event.currentTarget.open;
    setOpen(next);
    try { localStorage.setItem(key, String(next)); } catch { /* Menus remain usable when storage is unavailable. */ }
  }} />;
}
