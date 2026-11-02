export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand${compact ? ' brand-compact' : ''}`}>
    <span className="brand-symbol" aria-hidden="true"><i /><i /><i /><i /></span>
    <span>AISlots<span className="brand-dot">.</span></span>
  </span>;
}
