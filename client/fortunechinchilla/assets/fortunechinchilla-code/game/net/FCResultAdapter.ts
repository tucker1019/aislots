import type { onceRotateInfo, awardIconInfo } from '../3rd/game_1022';
import Long from '../3rd/Long';

export type Board = {id: number; symbolId: number}[][];
type Win = {symbolId: number; cellIds: number[]; columns: number; ways: number; rawPayout: string};
type Paid = Omit<Win, 'cellIds'> & {amount: string};
export type Frame = {
    board: Board; wins: Win[]; betId: string; stepIndex: number; balance: number;
    mode: 'base' | 'free'; nextAction: 'continue' | 'complete';
    requestId?: string; nextRequestId?: string; triggeredFree: boolean;
    winAmount: number; totalWinAmount: number; betAmount: number; freeRemaining: number;
    gameData: {ruleType: string; specialIndex: number; specialTotal: number; specialRemaining: number;
        lineWins: {line: number; symbolId: number; cellIds: number[]; payout: number}[];
        replay: {payouts: Paid[]}};
};

export const defaultBoard: Board = [[1, 2, 3], [4, 5, 6, 7], [8, 9, 10]].map((ids, col) =>
    ids.map((id, row) => ({id, symbolId: [[1, 3, 5], [4, 2, 6, 3], [5, 1, 4]][col][row]})));

export function boardToIcons(board: Board) {
    if (!Array.isArray(board) || board.length !== 3) throw new Error('Invalid AG10 board');
    const icons = Array<number>(12).fill(10);
    const indices = new Map<number, number>();
    let expectedId = 1;
    board.forEach((column, col) => {
        const height = col === 1 ? 4 : 3;
        if (!Array.isArray(column) || column.length !== height) throw new Error('Invalid AG10 column');
        column.forEach(({id, symbolId}, row) => {
            if (id !== expectedId++ || !Number.isInteger(symbolId) ||
                !(symbolId === 0 || symbolId >= 1 && symbolId <= 7 || symbolId >= 11 && symbolId <= 20)) {
                throw new Error('Invalid AG10 symbol');
            }
            const slot = (height - row - 1) * 3 + col;
            icons[slot] = symbolId || 10;
            indices.set(id, slot + 1);
        });
    });
    return {icons, indices};
}

export function toOriginalSpin(frame: Frame): {rotate: onceRotateInfo; rewardAmounts: Map<number, number>} {
    const {icons, indices} = boardToIcons(frame.board);
    const awards: awardIconInfo[] = [];
    const rewardAmounts = new Map<number, number>();
    const rewardSlots: number[] = [];
    let rewardTotal = 0, paidTotal = 0, lineIndex = 0;
    const data = frame.gameData;
    const payouts = data?.replay?.payouts;
    if (data?.ruleType !== 'fortune_rabbit_v1' || !Array.isArray(frame.wins) || !Array.isArray(payouts) ||
        payouts.length !== frame.wins.length || !Array.isArray(data.lineWins) ||
        ![frame.balance, frame.winAmount, frame.totalWinAmount, frame.betAmount].every(Number.isSafeInteger) ||
        !['base', 'free'].includes(frame.mode) || !['continue', 'complete'].includes(frame.nextAction) ||
        data.specialIndex !== frame.stepIndex - 1 || (data.specialIndex === 0) !== (frame.mode === 'base') ||
        data.specialRemaining !== frame.freeRemaining || (frame.freeRemaining > 0) !== (frame.nextAction === 'continue')) {
        throw new Error('Invalid AG10 frame');
    }
    frame.wins.forEach((win, i) => {
        const paid = payouts[i];
        const value = Number(paid.amount);
        if (!Number.isSafeInteger(value) || value < 0 || paid.symbolId !== win.symbolId ||
            paid.columns !== win.columns || paid.rawPayout !== win.rawPayout) throw new Error('Invalid AG10 payout');
        paidTotal += value;
        const slots = win.cellIds.map(id => {
            if (!indices.has(id)) throw new Error('Invalid AG10 win cell');
            return indices.get(id);
        });
        if (win.columns === 1 && slots.length === 1 && win.symbolId >= 11 && win.symbolId <= 20) {
            if (rewardAmounts.has(slots[0])) throw new Error('Duplicate AG10 reward');
            rewardSlots.push(slots[0]);
            rewardAmounts.set(slots[0], value);
            rewardTotal += value;
        } else {
            const line = data.lineWins[lineIndex++];
            if (!line || line.line < 1 || line.line > 10 || line.cellIds.join() !== win.cellIds.join())
                throw new Error('Invalid AG10 line');
            awards.push({flag_id: line.line, mIconIdxs: slots, mMoney: Long.fromValue(value), mWinOdds: line.payout});
        }
    });
    if (rewardSlots.length) awards.push({flag_id: 11, mIconIdxs: rewardSlots, mMoney: Long.fromValue(rewardTotal)});
    if (paidTotal !== frame.winAmount || lineIndex !== data.lineWins.length) throw new Error('Invalid AG10 win amount');
    return {rotate: {mIcons: icons, mAwardList: awards.length ? awards : null}, rewardAmounts};
}
