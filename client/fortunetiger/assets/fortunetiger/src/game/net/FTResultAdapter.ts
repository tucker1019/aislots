import type { Long, requestOpenAwardS2C } from '../3rd/game_1017';

type Money = number | string;
type Board = ReadonlyArray<ReadonlyArray<{ id: number; symbolId: number }>>;
export type GoFrame = {
    mode: string;
    board: Board;
    betId: string;
    stepIndex: number;
    nextAction: string;
    betAmount: Money;
    totalWinAmount: Money;
    balance: Money;
    gameData?: {
        targetSymbolId?: number | null;
        bonusMultiplier: number;
        lineWins: ReadonlyArray<{ lineIndex: number; cellIds: readonly number[]; payout: string }>;
    };
};

function money(value: Money): bigint {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('AG4: unsafe minor amount');
    if (!/^\d+$/.test(String(value))) throw new Error('AG4: invalid minor amount');
    return BigInt(value);
}

function asLong(value: bigint): Long {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('AG4: amount outside original client range');
    return { low: Number(BigInt.asIntN(32, value)), high: Number(value >> 32n), unsigned: false };
}

function originalCellIndex(id: number): number {
    if (!Number.isInteger(id) || id < 1 || id > 9) throw new Error('AG4: invalid cell id');
    return (2 - (id - 1) % 3) * 3 + Math.floor((id - 1) / 3);
}

export function originalBoard(board: Board): number[] {
    if (board.length !== 3 || board.some(col => col.length !== 3)) throw new Error('AG4: invalid board');
    const result: number[] = [];
    board.forEach((col, c) => col.forEach((cell, r) => {
        if (cell.id !== c * 3 + r + 1 || !Number.isInteger(cell.symbolId) || cell.symbolId < 0 || cell.symbolId > 7)
            throw new Error('AG4: invalid board cell');
        result[originalCellIndex(cell.id)] = cell.symbolId;
    }));
    return result;
}

export type OriginalAward = requestOpenAwardS2C & {
    mRotateData: requestOpenAwardS2C['mRotateData'] & { bonusMultiplier?: number };
};

/** Adapts completed Go results to the same decoded 10174 data used by the original controllers. */
export function toOriginalAward(frames: readonly GoFrame[], betIndex: number, levelIndex: number): OriginalAward {
    const first = frames[0];
    const last = frames[frames.length - 1];
    if (!first || last.nextAction !== 'complete' || frames.some((f, i) =>
        f.betId !== first.betId || f.mode !== first.mode || money(f.betAmount) !== money(first.betAmount) ||
        f.stepIndex !== i + 1 || (i < frames.length - 1 && f.nextAction !== 'continue'))) {
        throw new Error('AG4: incomplete or mismatched round');
    }
    const boards = frames.map(f => originalBoard(f.board));
    const data = last.gameData;
    if (!data || ![1, 10].includes(data.bonusMultiplier)) throw new Error('AG4: invalid feature data');
    const stake = money(first.betAmount);
    let numerator = 0n, denominator = 1n, paid = 0n;
    const lines = new Set<number>();
    const awards = data.lineWins.map(line => {
        if (!Number.isInteger(line.lineIndex) || line.lineIndex < 0 || line.lineIndex > 4 || lines.has(line.lineIndex) ||
            line.cellIds.length !== 3 || !/^\d+(\/\d+)?$/.test(line.payout)) throw new Error('AG4: invalid winning line');
        lines.add(line.lineIndex);
        const [n, d = '1'] = line.payout.split('/');
        const divisor = BigInt(d);
        if (divisor === 0n) throw new Error('AG4: invalid line payout');
        // Match Go: floor the cumulative payout in cents and use the difference per line.
        numerator = numerator * divisor + BigInt(n) * denominator;
        denominator *= divisor;
        const cumulative = numerator * stake * BigInt(data.bonusMultiplier) / (denominator * 5n);
        const award = {
            flag_id: line.lineIndex + 1,
            mIconIdxs: line.cellIds.map(id => originalCellIndex(id) + 1),
            mMoney: asLong(cumulative - paid),
            mWinOdds: Math.floor(Number(n) / Number(d)),
        };
        paid = cumulative;
        return award;
    });
    if (paid !== money(last.totalWinAmount)) throw new Error('AG4: line payouts do not match settlement');
    const rotate: OriginalAward['mRotateData'] = { mFreeIconIdx: 0, bonusMultiplier: data.bonusMultiplier };
    if (awards.length) rotate.mAwardList = awards;
    if (first.mode === 'base') {
        if (boards.length !== 1 || boards[0].includes(0)) throw new Error('AG4: invalid base result');
        rotate.mIcons = boards[0];
    } else if (first.mode === 'respin') {
        const target = first.gameData?.targetSymbolId;
        if (target == null || !Number.isInteger(target) || target < 1 || target > 6 || boards[0].some(Boolean) ||
            frames.some(f => f.gameData?.targetSymbolId !== target) || boards.some((board, i) =>
                board.some((id, j) => (id !== 0 && id !== target) || (i > 0 && boards[i - 1][j] !== 0 && id === 0)))) {
            throw new Error('AG4: invalid respin progression');
        }
        const terminal = boards[boards.length - 1];
        if (terminal.includes(0)) {
            const prior = boards[boards.length - 2];
            if (!prior || !terminal.every((id, i) => id === prior[i])) throw new Error('AG4: missing final no-add respin');
            // setEveryType adds this exact no-add pass for partial boards.
            boards.pop();
        }
        rotate.mFreeIconIdx = target;
        rotate.mFreeList = boards.map(mFreeIcons => ({ mFreeIcons }));
    } else {
        throw new Error('AG4: unexpected round mode');
    }
    return { mResult: 0, mMultipleIdx: betIndex + 1, moddsLevel: levelIndex + 1, isFree: 0,
        mMoney: asLong(money(last.balance)), win_money_all: asLong(paid), mRotateData: rotate };
}
