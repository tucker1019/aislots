export type Board = {id: number; symbolId: number}[][];
type LineWin = {line: number; symbolId: number; payout: number; cellIds: number[]};
type PaidItem = {symbolId: number; rawPayout: string; amount: string};
export interface Frame {
    betId: string; requestId: string; nextRequestId: string; stepIndex: number; spinIndex: number;
    board: Board; wins: {cellIds: number[]; symbolId: number}[];
    betAmount: number; balance: number; winAmount: number; totalWinAmount: number;
    nextAction: 'continue' | 'complete'; mode: 'base' | 'respin';
    gameData: {
        ruleType: 'fortune_mouse_v1'; special: boolean; stageIndex: number; stageTotal: number;
        stagesRemaining: number; lockedCellIds: number[]; lineWins: LineWin[]; rawPayout: number; jackpot: boolean;
        replay: {lineCount: number; payoutUnit: string; payouts: PaidItem[]};
    };
}
export const LINES = [[2,5,8],[1,4,7],[3,6,9],[1,5,9],[3,5,7]] as const;
export const PAYOUTS = [3,5,15,30,50,100,300] as const;
// Original client indexes visible cells left-to-right starting at the bottom row.
export const originalCell = (id: number) => (2 - ((id - 1) % 3)) * 3 + Math.floor((id - 1) / 3) + 1;
export const defaultBoard = [[6,6,6],[3,3,3],[4,4,4]].map((col, c) => col.map((symbolId, r) => ({id:c*3+r+1,symbolId})));
export function boardToIcons(board: Board) {
    if (!Array.isArray(board) || board.length !== 3 || board.some((col,c) => !Array.isArray(col) || col.length !== 3 ||
        col.some((cell,r) => cell?.id !== c*3+r+1 || !Number.isInteger(cell.symbolId) || cell.symbolId < 1 || cell.symbolId > 7)))
        throw new Error('Invalid AG6 board');
    const icons: number[] = [];
    for (const col of board) for (const cell of col) icons[originalCell(cell.id)-1] = cell.symbolId;
    return {icons};
}
export type OriginalSpin = {
    mIcons: number[];
    mAwardList: {flag_id: number; mIconIdxs: number[]; mMoney: number; mWinOdds: number}[];
};
export function toOriginalSpin(frame: Frame): {rotate: OriginalSpin} {
    const {icons} = boardToIcons(frame.board);
    const d = frame.gameData;
    const special = frame.mode === 'respin';
    const paid = d?.replay?.payouts;
    if (!d || d.ruleType !== 'fortune_mouse_v1' || d.special !== special ||
        (!special && frame.mode !== 'base') || !Number.isInteger(d.stageIndex) || d.stageIndex !== frame.stepIndex ||
        !Number.isInteger(d.stageTotal) || (special ? d.stageTotal < 3 || d.stageTotal > 9 : d.stageTotal !== 1) ||
        d.stageIndex < 1 || d.stageIndex > d.stageTotal || d.stagesRemaining !== d.stageTotal - d.stageIndex ||
        frame.nextAction !== (d.stagesRemaining ? 'continue' : 'complete') ||
        !Array.isArray(d.lockedCellIds) || d.lockedCellIds.join() !== (special ? '4,5,6' : '') ||
        (special && frame.board[1].some(c=>c.symbolId!==7)) || !Array.isArray(d.lineWins) ||
        d.replay?.lineCount !== 5 || !Array.isArray(paid) || !Array.isArray(frame.wins) ||
        ![frame.betAmount,frame.winAmount,frame.totalWinAmount,frame.balance,d.rawPayout].every(n=>Number.isSafeInteger(n)&&n>=0) ||
        frame.betAmount <= 0 || frame.totalWinAmount !== frame.winAmount || (d.stagesRemaining && frame.winAmount !== 0) ||
        typeof d.jackpot !== 'boolean' || d.jackpot !== icons.every(n=>n===7) ||
        paid.length !== (d.jackpot ? 1 : d.lineWins.length) || paid.length !== frame.wins.length)
        throw new Error('Invalid AG6 frame');
    const pay = (p: PaidItem) => {
        const n = Number(p.amount);
        if (typeof p.amount !== 'string' || !/^\d+$/.test(p.amount) || !Number.isSafeInteger(n)) throw new Error('Invalid AG6 paid amount');
        return n;
    };
    if (paid.reduce((sum,p)=>sum+pay(p),0)!==frame.winAmount ||
        d.rawPayout !== (d.jackpot ? 5000 : d.lineWins.reduce((sum,w)=>sum+w.payout,0)))
        throw new Error('Invalid AG6 payout');
    if (d.jackpot && (paid[0].rawPayout !== '5000' || paid[0].symbolId !== 7 || frame.wins[0].cellIds.length !== 9))
        throw new Error('Invalid AG6 jackpot');
    const seen=new Set<number>();
    const awards=d.lineWins.map((line,i)=>{
        const payout=paid[i], win=frame.wins[i];
        if (seen.has(line.line) || LINES[line.line-1]?.join()!==line.cellIds.join() ||
            line.cellIds.join()!==win.cellIds.join() || line.symbolId!==win.symbolId || line.symbolId!==payout.symbolId ||
            PAYOUTS[line.symbolId-1]!==line.payout || String(line.payout)!==payout.rawPayout)
            throw new Error('Invalid AG6 line award');
        seen.add(line.line);
        return {flag_id:line.line,mIconIdxs:line.cellIds.map(originalCell),mMoney:pay(payout),mWinOdds:line.payout};
    });
    const jackpotAward=d.jackpot ? [{flag_id:0,mIconIdxs:[1,2,3,4,5,6,7,8,9],mMoney:pay(paid[0]),mWinOdds:5000}] : [];
    return {rotate:{mIcons:icons,mAwardList:[...awards,...jackpotAward]}};
}
