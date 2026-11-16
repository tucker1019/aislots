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
    const whole = value / unit;
    return (negative && whole !== 0n ? '−' : '') + whole.toLocaleString('id-ID');
}
/** Currency fractions are truncated only for display; multiplier fractions stay precise. */
export function moneyFraction(raw: string, scale = 0) {
    try {
        const [numerator, denominator = '1'] = raw.split('/');
        const divisor = BigInt(denominator) * decimalUnit(scale);
        if (divisor === 0n) return '—';
        return (BigInt(numerator) / divisor).toLocaleString('id-ID');
    } catch { return '—'; }
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
        throw new Error("Pilih 1–7 hari berturut-turut. Tanggal akhir tidak boleh sebelum tanggal mulai.");
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
export const symbolNames: Record<number, string> = {1:"Koin",2:"Simpul Tiongkok",3:"Petasan",4:"Lentera",5:"Angpau",6:"Emas",7:"Wild Naga"};
