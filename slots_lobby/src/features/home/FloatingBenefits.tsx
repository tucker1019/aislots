import { useState } from 'react';
import { navigateLobby } from '../../app/useLobbyRoute';
import { t, useLanguageStore } from '../../i18n';

export function FloatingBenefits() {
  useLanguageStore(state => state.locale);
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return <aside className="floating-benefits">
    <button className="floating-benefits-entry" onClick={() => navigateLobby('benefits')} aria-label={t('copy.benefitsCenter')}>
      <img src="/assets/lobby/benefits/floating-fox.png" alt="" width="76" height="76" />
      <span>{t('benefits.floatingLabel')}</span>
    </button>
    <button className="floating-benefits-close" onClick={() => setVisible(false)} aria-label={t('benefits.closeFloating')}>×</button>
  </aside>;
}
