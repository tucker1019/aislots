export function PageNav({ page }: { page: 'analysis' | 'developer' }) {
  return <nav className="page-nav" aria-label="工作区">{([
    ['analysis', '数值分析'], ['developer', '开发页'],
  ] as const).map(([key, label]) => <a key={key} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined} href={`#/${key}`}>{label}</a>)}</nav>;
}
