export function coinsLabel(coins: number): string {
  return Math.floor(coins / 100).toLocaleString('zh-CN') + '.' + String(coins % 100).padStart(2, '0');
}

