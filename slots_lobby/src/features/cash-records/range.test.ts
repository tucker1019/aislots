import { expect, it } from 'vitest';
import { recordRange } from './range';
it('今天昨天按本地午夜划分，结束边界不含次日；跨年近7/30天包含今天', () => {
  const now = new Date(2026, 0, 2, 15, 30);
  expect(recordRange('today', now)).toEqual({ from: new Date(2026, 0, 2).toISOString(), to: new Date(2026, 0, 3).toISOString() });
  expect(recordRange('yesterday', now)).toEqual({ from: new Date(2026, 0, 1).toISOString(), to: new Date(2026, 0, 2).toISOString() });
  expect(recordRange('week', now).from).toBe(new Date(2025, 11, 27).toISOString());
  expect(recordRange('month', now).from).toBe(new Date(2025, 11, 4).toISOString());
});
