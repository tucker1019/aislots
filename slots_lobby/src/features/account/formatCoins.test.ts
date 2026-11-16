import { afterEach, expect, it } from 'vitest';
import { coinsLabel } from './formatCoins';
import { betMoney } from '../bet-records/money';
import { statisticsMoney } from '../../services/game-statistics';
import { useLanguageStore } from '../../i18n';

const originalLocale = useLanguageStore.getState().locale;
afterEach(() => useLanguageStore.setState({ locale: originalLocale }));
it('shows whole rupiah without rounding up or changing minor-unit inputs', () => {
  useLanguageStore.setState({ locale: 'id-ID' });
  for (const format of [coinsLabel, betMoney]) {
    expect(format(1803002)).toBe('Rp18.030');
    expect(format(199)).toBe('Rp1');
    expect(format(-199)).toBe('-Rp1');
    expect(format(-50)).toBe('Rp0');
    expect(format(0)).toBe('Rp0');
  }
  expect(statisticsMoney('900719925474099199')).toBe('Rp9.007.199.254.740.991');
  expect(statisticsMoney('-199')).toBe('-Rp1');
});
it.each(['zh-TW', 'en-US', 'id-ID'] as const)('hides fractional currency in %s', locale => {
  useLanguageStore.setState({ locale });
  const expected = 'Rp1.234';
  expect(coinsLabel(123499)).toBe(expected);
  expect(betMoney(123499)).toBe(expected);
  expect(statisticsMoney('123499')).toBe(expected);
});
