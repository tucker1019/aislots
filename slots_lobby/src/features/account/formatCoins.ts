import { getLocale } from '../../i18n';
export function coinsLabel(coins: number): string {
  return Math.floor(coins / 100).toLocaleString(getLocale()) + '.' + String(coins % 100).padStart(2, '0');
}

