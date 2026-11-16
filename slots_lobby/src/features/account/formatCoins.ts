// API amounts remain in minor units. Only display whole currency units;
// truncate instead of rounding up balances or rewards that cannot be spent.
export function coinsLabel(coins: number | string): string {
  const whole = typeof coins === 'string' ? BigInt(coins) / 100n : Math.trunc(coins / 100);
  const negative = whole < 0;
  const absolute = whole === 0 ? 0 : negative ? -whole : whole;
  return `${negative ? '-' : ''}Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(absolute)}`;
}
