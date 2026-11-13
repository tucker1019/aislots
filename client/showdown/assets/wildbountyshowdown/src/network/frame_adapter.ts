import { Frame, ViewAward } from './game_types';
export const HEIGHTS = [3, 4, 5, 5, 4, 3];
export const INDICES = [[0, 6, 12], [1, 7, 13, 18], [2, 8, 14, 19, 22], [3, 9, 15, 20, 23], [4, 10, 16, 21], [5, 11, 17]];
export function activeColumns(frame: Pick<Frame, 'board' | 'previewRows'>): number[][] {
    if (frame.board.length !== 6)
        throw Error('Invalid board columns');
    return frame.board.map((col, c) => { const active = col.slice(frame.previewRows || 0); if (active.length !== HEIGHTS[c])
        throw Error('Invalid active rows'); return active.map(cell => cell.symbolId).reverse(); });
}
export function adaptFrame(frame: Frame): {
    icons: number[];
    awards: ViewAward[];
    factor: number;
    transformedPositions: number[];
    removedPositions: number[];
} {
    const cols = activeColumns(frame), icons: number[] = [], positions = new Map<number, number>();
    for (let c = 0; c < 6; c++) {
        cols[c].forEach((symbol, r) => { icons[INDICES[c][r]] = symbol; });
        const cells = frame.board[c].slice(frame.previewRows || 0).reverse();
        cells.forEach((cell, r) => positions.set(cell.id, INDICES[c][r] + 1));
    }
    const ids = Array.from(new Set(frame.wins.flatMap(win => win.cellIds))).map(id => { const pos = positions.get(id); if (pos === undefined)
        throw Error('Unknown winning cell ID'); return pos; });
    const factor = Number(frame.cascadeFactors?.[frame.cascadeIndex]);
    if (!Number.isFinite(factor) || factor <= 0)
        throw Error('Invalid cascade factor');
    const locate = (ids: number[]) => ids.map(id => { const pos = positions.get(id); if (pos === undefined)
        throw Error('Unknown changed cell ID'); return pos; });
    return { transformedPositions: locate(frame.transformedIds), removedPositions: locate(frame.removedIds), icons, awards: ids.length ? [{ mWinNum: 1, mMoney: frame.winAmount, mIconIdxs: ids }] : [], factor };
}
