/** 金额全程整数/分数运算，不把大额余额转换成浮点数。 */
// 避免 BigInt 幂运算被 Cocos 转成不支持 BigInt 的 Math.pow。
function decimalUnit(digits: number): bigint {
    return BigInt('1' + '0'.repeat(Math.max(0, Math.min(20, Math.trunc(digits)))));
}
export function money(raw: string | number, scale = 0, _currency = 'IDR') {
    let value: bigint;
    try {
        value = BigInt(raw);
    } catch {
        return '—';
    }
    const negative = value < 0n;
    if (negative) value = -value;
    const unit = decimalUnit(Math.max(0, Math.min(9, scale)));
    const integer = (value / unit).toLocaleString('en-US');
    const decimals = scale ? '.' + (value % unit).toString().padStart(scale, '0') : '';
    return (negative ? '−' : '') + integer + decimals;
}
export function fraction(raw: string, decimals = 4, scale = 0) {
    const [a, b = '1'] = raw.split('/');
    // 十进制rawPayout通常已是短字符串，分数才做精确展开。
    if (!raw.includes('/') && !scale) return raw;
    try {
        const n = BigInt(a),
            d = BigInt(b) * decimalUnit(scale);
        if (d === 0n) return '—';
        const precision = decimalUnit(decimals);
        const value = (n * precision) / d;
        return (
            (value / precision).toString() +
            (value % precision
                ? '.' + (value % precision).toString().padStart(decimals, '0').replace(/0+$/, '')
                : '')
        );
    } catch {
        return '—';
    }
}
export function todayGMT8(now = Date.now()) {
    return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}
export function dateRange(start: string, end: string) {
    const from = new Date(start + 'T00:00:00+08:00');
    const endDay = new Date(end + 'T00:00:00+08:00');
    if (
        !Number.isFinite(+from) ||
        !Number.isFinite(+endDay) ||
        todayGMT8(+from) !== start ||
        todayGMT8(+endDay) !== end ||
        endDay < from ||
        +endDay - +from > 6 * 86400000
    )
        throw new Error('请选择连续1至7天，结束日期不能早于开始日期');
    return { from: from.toISOString(), to: new Date(+endDay + 86400000).toISOString() };
}
export function recentDates(days: number, now = Date.now()) {
    const end = todayGMT8(now);
    const start = new Date(new Date(end + 'T00:00:00Z').getTime() - (days - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
    return { start, end };
}
export function dateText(raw: string, full = false) {
    const date = new Date(raw);
    if (!Number.isFinite(+date)) return '—';
    const value = new Date(+date + 8 * 3600000).toISOString();
    return full
        ? value.slice(0, 10).replace(/-/g, '/') + ' ' + value.slice(11, 19)
        : value.slice(11, 19) + '\n' + value.slice(5, 10).replace('-', '/');
}
export function gameBounds(
    rect: { left: number; top: number; width: number; height: number },
    width = 750,
    height = 1400,
) {
    const scale = Math.min(rect.width / width, rect.height / height);
    return {
        left: rect.left + (rect.width - width * scale) / 2,
        top: rect.top + (rect.height - height * scale) / 2,
        width: width * scale,
        height: height * scale,
    };
}
export const symbolNames: Record<number, string> = {
    1: '蒙面牛仔', 2: '左轮手枪', 3: '牛仔帽', 4: '威士忌',
    5: 'A', 6: 'K', 7: 'Q', 8: 'J', 9: 'Wild', 10: 'Scatter',
};
