import { version as webVersion } from '../../package.json';
import { getLocale } from '../i18n';

const DEVICE_UUID_STORAGE_KEY = 'aggame_device_uuid';
const URL_OVERRIDE_STORAGE_KEY = 'aggame_atomic_overrides';
const DEFAULT_APP_NAME = 'aggame';
const DEFAULT_COUNTRY = 'ID';

export interface AtomicParams {
  app_name: string;
  cv: string;
  uuid: string;
  lca_coun: string;
  lca_lang: string;
  client_ts: string;
}

interface AtomicOverrides {
  app_name?: string;
  cv?: string;
  uuid?: string;
}

function generateDeviceUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateDeviceUuid(): string {
  try {
    const existing = localStorage.getItem(DEVICE_UUID_STORAGE_KEY)?.trim();
    if (existing) return existing;
    const created = generateDeviceUuid();
    localStorage.setItem(DEVICE_UUID_STORAGE_KEY, created);
    return created;
  } catch {
    return generateDeviceUuid();
  }
}

function readStoredOverrides(): AtomicOverrides {
  try {
    const raw = sessionStorage.getItem(URL_OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const record = parsed as Record<string, unknown>;
    return {
      ...(typeof record.app_name === 'string' && record.app_name ? { app_name: record.app_name } : {}),
      ...(typeof record.cv === 'string' && record.cv ? { cv: record.cv } : {}),
      ...(typeof record.uuid === 'string' && record.uuid ? { uuid: record.uuid } : {}),
    };
  } catch {
    return {};
  }
}

function readUrlOverrides(): AtomicOverrides {
  const stored = readStoredOverrides();
  if (typeof window === 'undefined') return stored;
  const search = new URLSearchParams(window.location.search);
  const appName = (search.get('app_name') || search.get('appname') || '').trim();
  const cv = (search.get('cv') || '').trim();
  const uuid = (search.get('uuid') || '').trim();

  const merged: AtomicOverrides = {
    ...stored,
    ...(appName ? { app_name: appName } : {}),
    ...(cv ? { cv } : {}),
    ...(uuid ? { uuid } : {}),
  };

  if (appName || cv || uuid) {
    try {
      sessionStorage.setItem(URL_OVERRIDE_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }
  return merged;
}

function detectBrowserLang(): string {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.trim()) {
    return navigator.language.trim();
  }
  return getLocale();
}

function detectBrowserCountry(lang: string): string {
  const parts = lang.split(/[-_]/);
  if (parts.length >= 2) {
    const region = parts[parts.length - 1].toUpperCase();
    if (/^[A-Z]{2}$/.test(region)) {
      return region;
    }
  }
  return DEFAULT_COUNTRY;
}

export function getAtomicParams(): AtomicParams {
  const overrides = readUrlOverrides();
  const lang = detectBrowserLang();
  return {
    app_name: overrides.app_name || DEFAULT_APP_NAME,
    cv: overrides.cv || `AGGAMEWEB_${webVersion}`,
    uuid: overrides.uuid || getOrCreateDeviceUuid(),
    lca_coun: detectBrowserCountry(lang),
    lca_lang: lang,
    client_ts: String(Date.now()),
  };
}

export function isAndroidApp(): boolean {
  return getAtomicParams().cv.toUpperCase().startsWith('AGGAMEAPK_');
}

export function appendAtomicParams(rawUrl: string): string {
  const atomic = getAtomicParams();
  const [withoutHash, hash = ''] = rawUrl.split('#');
  const queryIndex = withoutHash.indexOf('?');
  const basePath = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '');

  (Object.entries(atomic) as Array<[keyof AtomicParams, string]>).forEach(([key, value]) => {
    if (!params.has(key) && value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  const hashSuffix = hash ? `#${hash}` : '';
  return query ? `${basePath}?${query}${hashSuffix}` : `${basePath}${hashSuffix}`;
}
