export const BIG_WIN_COUNT_SECONDS = 8;
/** 分段计数让每个等级都有演出时间，大额中奖也不会一帧跨过多个等级。
 * 各段终点是实际投注额的15倍、50倍及最终赢分；金额始终使用整数。 */
export function bigWinFrame(amount: string, bet: string, finalTier: number, age: number) {
    const total = BigInt(amount), stake = BigInt(bet);
    const tiers = Math.max(1, Math.min(3, finalTier));
    const position = Math.max(0, Math.min(1, age / BIG_WIN_COUNT_SECONDS)) * tiers;
    const segment = Math.min(tiers - 1, Math.floor(position));
    const boundaries = [0n];
    if (tiers >= 2) boundaries.push(stake * 15n);
    if (tiers >= 3) boundaries.push(stake * 50n);
    boundaries.push(total);
    const start = boundaries[segment], end = boundaries[segment + 1];
    const progress = BigInt(Math.floor(Math.min(1, position - segment) * 10000));
    return { tier: segment + 1, amount: (start + (end - start) * progress / 10000n).toString() };
}
