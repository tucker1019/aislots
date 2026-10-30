import type { Cell } from '../network/game/game_api';
// 数值工具的 symbolId 与场景美术编号不同，统一在此转换。
const artwork: Record<number, number> = {
    1: 11,
    2: 7,
    3: 5,
    4: 8,
    5: 6,
    6: 1,
    7: 4,
    8: 3,
    9: 2,
    10: 10,
    11: 9,
};
/** 每列条带：上装饰牌 + 服务端预览牌 + 4张有效牌 + 下装饰牌，顺序从上到下。
 * 同一次消除传入 previous，保留装饰牌，防止露边图标突然改变。
 */
export function serverStrips(board: Cell[][], pick: (c: number) => number, previous?: number[][]) {
    if (!Array.isArray(board) || board.length !== 5) throw new Error('需要5列服务端盘面');
    const ids = new Set<number>();
    return board.map((col, c) => {
        if (col.length !== 5) throw new Error('当前场景需要1个预览格和4个有效格');
        const values = col.map((cell) => {
            if (!Number.isSafeInteger(cell.id) || cell.id < 1 || ids.has(cell.id))
                throw new Error('盘面格子标识重复或无效');
            ids.add(cell.id);
            const gold = cell.symbolId > 1000,
                symbol = gold ? cell.symbolId - 1000 : cell.symbolId,
                value = artwork[symbol];
            if (!value || (gold && symbol > 9)) throw new Error('未知图标');
            return value + (gold ? 1000 : 0);
        });
        const old = previous?.[c];
        return [old?.[0] ?? pick(c), ...values, old?.[6] ?? pick(c)];
    });
}
/** 用稳定格子 ID 计算来源行；负数表示从旧预览牌上方补入的新牌。 */
export function gravitySources(previous: Cell[][], next: Cell[][]) {
    return next.map((col, c) => {
        const rows = new Map(previous[c].map((cell, row) => [cell.id, row]));
        const shift = col.reduce(
            (n, cell, row) => Math.max(n, rows.has(cell.id) ? row - rows.get(cell.id) : 0),
            0,
        );
        return col.map((cell, row) => rows.get(cell.id) ?? row - shift);
    });
}

/** 仅真正发生位移的列参与排队，按从右到左分配连续间隔。 */
export function cascadeDropDelays(sources: number[][], interval: number): number[] {
    const delays = sources.map(() => 0);
    let order = 0;
    for (let column = sources.length - 1; column >= 0; column--) {
        if (sources[column].some((source, row) => row > source)) {
            delays[column] = order++ * interval;
        }
    }
    return delays;
}
