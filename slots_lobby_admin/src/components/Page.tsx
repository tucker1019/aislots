import type { ReactNode } from 'react';
export function Page({ eyebrow, title, description, tools, filters, children }: { eyebrow: string; title: string; description: string; tools?: ReactNode; filters?: ReactNode; children: ReactNode }) {
 return <section className="page"><div className="page-sticky"><div className="page-top"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{tools}</div>{filters}</div>{children}</section>;
}
