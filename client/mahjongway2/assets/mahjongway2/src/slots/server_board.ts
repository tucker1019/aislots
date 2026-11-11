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
export const COLUMN_HEIGHTS = [4, 5, 5, 5, 4] as const;
export const STRIP_CELL_COUNT = 8;
/** 每列条带：上装饰牌 + 服务端预览牌 + 本列有效牌 + 下装饰牌，顺序从上到下。
 * 同一次消除传入 previous，保留装饰牌，防止露边图标突然改变。
 */
export function serverStrips(board: Cell[][], pick: (c: number) => number, previous?: number[][]) {
    if (!Array.isArray(board) || board.length !== 5) throw new Error('需要5列服务端盘面');
    const ids = new Set<number>();
    return board.map((col, c) => {
        const hasPreview = col.length === COLUMN_HEIGHTS[c] + 1;
        if (!hasPreview && col.length !== COLUMN_HEIGHTS[c])
            throw new Error('AG2 第' + (c + 1) + '列有效格数量错误');
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
        const preview = hasPreview ? [] : [old?.[1] ?? pick(c)];
        const strip = [old?.[0] ?? pick(c), ...preview, ...values];
        while (strip.length < STRIP_CELL_COUNT)
            strip.push(old?.[strip.length] ?? pick(c));
        return strip;
    });
}
/** 用稳定格子 ID 计算来源行；负数表示从旧预览牌上方补入的新牌。 */
export function previewRowCount(board: Cell[][]): number {
    return board[0].length - COLUMN_HEIGHTS[0];
}

export function gravitySources(previous: Cell[][], next: Cell[][]) {
    const previousOffset = 1 - previewRowCount(previous);
    const nextOffset = 1 - previewRowCount(next);
    return next.map((col, c) => {
        const rows = new Map(previous[c].map((cell, row) => [cell.id, row + previousOffset]));
        const shift = col.reduce(
            (n, cell, row) => Math.max(n, rows.has(cell.id) ? row + nextOffset - rows.get(cell.id) : 0),
            0,
        );
        const sources = col.map((cell, row) => rows.get(cell.id) ?? row + nextOffset - shift);
        return nextOffset ? [-1, ...sources] : sources;
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
