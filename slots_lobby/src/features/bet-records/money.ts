import { getLocale } from '../../i18n';
export const betMoney = (value: number) => (value / 100).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
