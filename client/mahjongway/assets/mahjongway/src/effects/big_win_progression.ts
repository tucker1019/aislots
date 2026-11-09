export const BIG_WIN_COUNT_SECONDS = 8;
const BIG_WIN_MULTIPLIER = 10n;
const MEGA_WIN_MULTIPLIER = 25n;
const SUPER_WIN_MULTIPLIER = 60n;

export function bigWinType(amount: string, bet: string) {
    const win = BigInt(amount), stake = BigInt(bet);
    if (stake <= 0n) return 0;
    if (win >= stake * SUPER_WIN_MULTIPLIER) return 3;
    if (win >= stake * MEGA_WIN_MULTIPLIER) return 2;
    return win >= stake * BIG_WIN_MULTIPLIER ? 1 : 0;
}

/** 分段计数让每个等级都有演出时间，大额中奖也不会一帧跨过多个等级。
 * 各段终点是实际投注额的25倍、60倍及最终赢分；金额始终使用整数。 */
export function bigWinFrame(amount: string, bet: string, finalTier: number, age: number) {
    const total = BigInt(amount), stake = BigInt(bet);
    const tiers = Math.max(1, Math.min(3, finalTier));
    const position = Math.max(0, Math.min(1, age / BIG_WIN_COUNT_SECONDS)) * tiers;
    const segment = Math.min(tiers - 1, Math.floor(position));
    const boundaries = [0n];
    if (tiers >= 2) boundaries.push(stake * MEGA_WIN_MULTIPLIER);
    if (tiers >= 3) boundaries.push(stake * SUPER_WIN_MULTIPLIER);
    boundaries.push(total);
    const start = boundaries[segment], end = boundaries[segment + 1];
    const progress = BigInt(Math.floor(Math.min(1, position - segment) * 10000));
    return { tier: segment + 1, amount: (start + (end - start) * progress / 10000n).toString() };
}
