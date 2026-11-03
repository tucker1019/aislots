import type { ReactNode } from 'react';
import { Icon } from '../Icon';
interface Props { title: string; backLabel: string; onBack: () => void; filters?: ReactNode; children: ReactNode; className?: string }
/** Record lists and receipts share one scroll container and one sticky header/filter block. */
export function RecordsLayout({ title, backLabel, onBack, filters, children, className = '' }: Props) {
  return <section className={`records-page ${className}`} aria-label={title}>
    <div className="records-page-top">
      <header className="records-page-header"><button type="button" aria-label={backLabel} onClick={onBack}><Icon name="chevron" size={20} /></button><h1>{title}</h1><span /></header>
      {filters}
    </div>
    <div className="records-page-body">{children}</div>
  </section>;
}
