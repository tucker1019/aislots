import type { ReactNode } from 'react';
import { Icon } from '../Icon';
interface Props { title: string; backLabel?: string; onBack?: () => void; filters?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }
/** Record lists and receipts share one scroll container and one sticky header/filter block. */
export function RecordsLayout({ title, backLabel, onBack, filters, actions, children, className = '' }: Props) {
  return <section className={`records-page ${className}`} aria-label={title}>
    <div className="records-page-top">
      <div className="records-page-header">{onBack ? <button type="button" aria-label={backLabel} onClick={onBack}><Icon name="chevron" size={20} /></button> : <span />}<h1>{title}</h1>{actions ?? <span />}</div>
      {filters}
    </div>
    <div className="records-page-body">{children}</div>
  </section>;
}
