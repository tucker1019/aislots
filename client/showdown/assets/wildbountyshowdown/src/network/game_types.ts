export interface Cell {
    id: number;
    symbolId: number;
}
export interface Frame {
    requestId: string;
    nextRequestId: string;
    betId: string;
    spinIndex: number;
    stepIndex: number;
    mode: 'base' | 'free';
    nextAction: 'continue' | 'start_free' | 'complete';
    board: Cell[][];
    wins: {
        symbolId: number;
        cellIds: number[];
    }[];
    removedIds: number[];
    transformedIds: number[];
    balance: number;
    betAmount: number;
    winAmount: number;
    totalWinAmount: number;
    freeRemaining: number;
    awardedFreeSpins?: number;
    triggeredFree?: boolean;
    previewRows?: number;
    cascadeFactors: string[];
    cascadeIndex: number;
    spinWinAmount?: number;
}
export interface Progress {
    lastFrame?: Frame;
    requestId: string;
    balance: number;
    hasNext: boolean;
    betAmount?: number;
}
export interface BetConfig {
    betOptions: string[];
    defaultBet: string;
    lineCount: number;
    betLevel: number;
}
/** Native view data for the CURRENT settled frame only; never a prefetched round. */
export interface ViewAward {
    mWinNum: number;
    mMoney: number;
    mIconIdxs: number[];
}
export interface RotateView {
    mIconsList: {
        mIcons: number[];
    }[];
    mAwardList: ViewAward[];
    mFreeGameCount: number;
    freeMax: number;
    isFree: number;
}
export type Request = <T>(path: string, body?: object, token?: string) => Promise<T>;
