export type Board = {id: number; symbolId: number}[][];
type Payout = {symbolId: number; amount: string};
type LineWin = {line: number; symbolId: number; cellIds: number[]};
export type Frame = {
    requestId: string; nextRequestId: string; betId: string; stepIndex: number;
    betAmount: number; balance: number; winAmount: number; totalWinAmount: number;
    board: Board; wins: {cellIds: number[]; symbolId: number}[]; buyMode: 1 | 2;
    mode: 'base' | 'free'; nextAction: 'continue' | 'complete'; freeRemaining: number;
    triggeredFree?: boolean; awardedFreeSpins?: number;
    gameData: {
        stageIndex: number; stageTotal: number; blankMultiplier: boolean;
        multipliers: number[]; multiplierSum: number; lineWins: LineWin[];
        replay: {payouts: Payout[]};
    };
};

export const LINES = [[2,5,8],[1,4,7],[3,6,9],[1,5,9],[3,5,7]];
export const PAYOUTS = [2,3,5,10,25,50,100];

// The native scene reads rows from the bottom, the API sends columns from the top.
const order = [3,6,9,2,5,8,1,4,7];
export const defaultBoard: Board = [[1,5,5],[1,6,5],[5,6,6]]
    .map((col, c) => col.map((symbolId,r) => ({id:c*3+r+1,symbolId})));
const invalid = () => new Error('Invalid AG8 frame');
export function boardToIcons(board: Board) {
    if (board?.length !== 3 || board.some((col,c) => col?.length !== 3 ||
        col.some((cell,r) => cell?.id !== c*3+r+1 || !Number.isInteger(cell.symbolId) ||
            cell.symbolId < 1 || cell.symbolId > 7))) throw invalid();
    const cells = board.flat();
    return {icons: order.map(id => cells[id-1].symbolId)};
}

export function toOriginalSpin(frame: Frame, payouts = frame.gameData?.replay?.payouts) {
    const {icons} = boardToIcons(frame.board);
    const g = frame.gameData;
    const free = frame.mode === 'free';
    if (!g || (!free && frame.mode !== 'base') || ![1,2].includes(frame.buyMode) ||
        ![frame.betAmount,frame.winAmount,frame.totalWinAmount,frame.freeRemaining].every(v => Number.isSafeInteger(v) && v >= 0) ||
        frame.totalWinAmount < frame.winAmount || g.stageIndex !== frame.stepIndex ||
        !Number.isInteger(g.stageIndex) || g.stageIndex < 1 || !Number.isInteger(g.stageTotal) ||
        Boolean(frame.triggeredFree) !== (free && g.stageIndex === 1) ||
        (frame.triggeredFree && frame.awardedFreeSpins !== 8) ||
        g.stageTotal < g.stageIndex || g.stageTotal > (free ? 8 : 1) ||
        frame.freeRemaining !== (free && g.stageIndex < g.stageTotal ? 8-g.stageIndex : 0) ||
        frame.nextAction !== (frame.freeRemaining ? 'continue' : 'complete') ||
        !Array.isArray(g.multipliers) || !g.multipliers.every(m => [1,2,5,10].includes(m)) ||
        (free ? ![2,3].includes(g.multipliers.length) || g.blankMultiplier || g.multipliers.includes(1) :
            g.multipliers.length !== 1 || (g.multipliers[0] === 1) !== g.blankMultiplier) ||
        g.multiplierSum !== g.multipliers.reduce((a,b) => a+b,0) ||
        !Array.isArray(g.lineWins) || !Array.isArray(payouts) || payouts.length !== g.lineWins.length) throw invalid();
    const mAwardList = g.lineWins.map((win,i) => {
        const payout = payouts[i];
        const mMoney = Number(payout.amount);
        const cells = LINES[win.line-1];
        if (!cells || cells.join() !== win.cellIds.join() || payout.symbolId !== win.symbolId ||
            !Number.isSafeInteger(mMoney) || mMoney < 0) throw invalid();
        return {flag_id:win.line, mIconIdxs:win.cellIds.map(id => order.indexOf(id)+1), mMoney};
    });
    if (mAwardList.reduce((n,w) => n+w.mMoney,0) !== frame.winAmount) throw invalid();
    return {rotate:{mIcons:icons, mAwardList:mAwardList.filter(w => w.mMoney>0),
        awardMul:g.blankMultiplier ? [0] : g.multipliers, isAward:frame.winAmount ? 1 : 0,
        freeMax:free ? 8 : 0, isFree:free ? 1 : 0, mFreeGameCount:frame.freeRemaining}};
}
export type Rotation = ReturnType<typeof toOriginalSpin>['rotate'];

export function wagerAmount(bet: string, level: number, lineCount: number, mode: number) {
    return Number(bet)*level*lineCount*(mode === 2 ? 5 : 1);
}
