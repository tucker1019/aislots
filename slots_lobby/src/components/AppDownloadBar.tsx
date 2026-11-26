import { useState } from 'react';
import { useLobbyContent } from '../features/home/useLobbyContent';
import { coinsLabel } from '../features/account/formatCoins';
import { t } from '../i18n';

const APK_DOWNLOAD_URL = 'https://aggames.buzz/downloads/aggames-debug.apk';
const DISMISS_KEY = 'aislots-app-download-dismissed';

export function shouldShowAppDownloadBar(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(DISMISS_KEY) === '1') return false;
  } catch {
    // ignore storage errors
  }
  const ua = navigator.userAgent || '';
  if (/\bwv\b|; wv\)/i.test(ua)) return false;
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return false;
  return true;
}

export function AppDownloadBar() {
  const [visible, setVisible] = useState(() => shouldShowAppDownloadBar());
  const content = useLobbyContent();
  if (!visible) return null;

  const maxReward = content.data?.newbieMaxReward ?? 0;

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  }

  return (
    <div className="app-download-bar" role="region" aria-label={t('appDownload.action')}>
      <button type="button" className="app-download-close" aria-label={t('appDownload.close')} onClick={dismiss}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <img className="app-download-icon" src="/pwa-192x192.png" alt="" width={30} height={30} />
      <p className="app-download-copy">
        {maxReward > 0 ? (
          <>
            <span>{t('appDownload.prefix')} </span>
            <strong className="app-download-amount">{coinsLabel(maxReward)}</strong>
            {t('appDownload.suffix') ? <span> {t('appDownload.suffix')}</span> : null}
          </>
        ) : (
          <span>{t('appDownload.fallback')}</span>
        )}
      </p>
      <a className="app-download-cta" href={APK_DOWNLOAD_URL} download>
        {t('appDownload.action')}
      </a>
    </div>
  );
}
