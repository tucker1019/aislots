import { PAYOUTS } from '../rules/paytable_data';
const serverSymbols: Record<number, number> = { 1:6, 2:9, 3:8, 4:7, 5:3, 6:5, 7:2, 8:4, 9:11, 10:10, 11:1 };
/** 与 HTML 赔率表使用同一份展示数据，不把美术编号当成服务端图标编号。 */
export function symbolTip(value: number) {
    const native = value > 1000 ? value - 1000 : value;
    const symbol = serverSymbols[native];
    const payout = PAYOUTS.find(row => row.symbol === symbol);
    return { payout: payout?.values,
        description: symbol === 10 ? '百搭可替代除胡以外的所有图标。' :
            symbol === 11 ? '3 个胡图标可触发免费旋转。' : '该图标暂无赔率说明。' };
}
export function tipPosition(x: number, y: number, column: number, special: boolean) {
    const direction = column < 3 ? 1 : -1;
    const gap = 82 + (special ? 50 : 0), width = special ? 412 : 312;
    return { x: Math.max(-360 + width/2, Math.min(360 - width/2, x + direction*gap)),
        y: Math.max(-419, Math.min(396, y)), direction, gap, width };
}
