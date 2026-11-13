import { getLocale } from '../../i18n';
export function coinsLabel(coins: number): string {
  return (coins / 100).toLocaleString(getLocale(), {minimumFractionDigits:2,maximumFractionDigits:2});
}

