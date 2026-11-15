export type Board = {id: number; symbolId: number}[][];
type LineWin = {line: number; symbolId: number; payout: number; cellIds: number[]};
type PaidItem = {symbolId: number; rawPayout: string; amount: string};
export interface Frame {
    betId: string; requestId: string; nextRequestId: string; stepIndex: number; spinIndex: number;
    board: Board; wins: {cellIds: number[]; symbolId: number}[];
    betAmount: number; balance: number; winAmount: number; totalWinAmount: number;
    nextAction: 'continue' | 'complete'; mode: 'base' | 'respin';
    gameData: {
        ruleType: 'fortune_ox_v1'; special: boolean; stageIndex: number; stageTotal: number;
        stagesRemaining: number; lockedCellIds: number[]; sharedCellIds: number[]; sharedSymbolId: number;
        lineWins: LineWin[]; rawPayout: number; jackpot: boolean; fullBoard: boolean;
        fullSymbolId: number; fullBoardMultiplier: number;
        replay: {lineCount: number; payoutUnit: string; payouts: PaidItem[]};
    };
}
export const LINES = [[1,4,8],[1,5,8],[1,5,9],[2,5,8],[2,5,9],[2,6,9],[2,6,10],[3,6,9],[3,6,10],[3,7,10]] as const;
export const PAYOUTS = [3,5,10,20,50,100,200] as const;
const slots = [7,4,1,11,8,5,2,9,6,3] as const;
const heights = [3,4,3];
const offsets = [0,3,7];
const shared = [1,2,3,8,9,10];
export const originalCell = (id: number) => slots[id - 1];
export const defaultBoard = [[1,4,3],[5,2,6,4],[3,5,1]].map((col, c) => col.map((symbolId,r) => ({id:offsets[c]+r+1,symbolId})));
export function boardToIcons(board: Board) {
    if (!Array.isArray(board) || board.length !== 3 || board.some((col,c) => !Array.isArray(col) || col.length !== heights[c] ||
        col.some((cell,r) => cell?.id !== offsets[c]+r+1 || !Number.isInteger(cell.symbolId) || cell.symbolId < 1 || cell.symbolId > 7)))
        throw new Error('Invalid AG7 board');
    // Legacy indices are left-to-right, bottom-to-top. Index 10 is out of view.
    const icons = Array<number>(11).fill(0);
    for (const col of board) for (const cell of col) icons[originalCell(cell.id)-1] = cell.symbolId;
    return {icons};
}
export function columnIcons(icons: number[], col: number) {
    return Array.from({length:heights[col]}, (_, row) => icons[row*3+col]);
}
export function toOriginalSpin(frame: Frame) {
    const {icons} = boardToIcons(frame.board);
    const d = frame.gameData;
    const special = frame.mode === 'respin';
    const paid = d?.replay?.payouts;
    const visible = frame.board.flat().map(c=>c.symbolId);
    const normal = Array.from(new Set(visible.filter(n=>n!==7)));
    const jackpot = normal.length === 0;
    const full = normal.length === 1;
    if (!d || d.ruleType !== 'fortune_ox_v1' || d.special !== special ||
        (!special && frame.mode !== 'base') || !Number.isInteger(d.stageIndex) || d.stageIndex !== frame.stepIndex ||
        !Number.isInteger(d.stageTotal) || (special ? d.stageTotal < 3 || d.stageTotal > 9 : d.stageTotal !== 1) ||
        d.stageIndex < 1 || d.stageIndex > d.stageTotal || d.stagesRemaining !== d.stageTotal - d.stageIndex ||
        frame.nextAction !== (d.stagesRemaining ? 'continue' : 'complete') ||
        !Array.isArray(d.lockedCellIds) || d.lockedCellIds.length || !Array.isArray(d.sharedCellIds) ||
        d.sharedCellIds.join() !== (special ? shared.join() : '') ||
        (special && (!Number.isInteger(d.sharedSymbolId) || d.sharedSymbolId < 1 || d.sharedSymbolId > 6 ||
            shared.some(id=>visible[id-1] !== d.sharedSymbolId))) ||
        !Array.isArray(d.lineWins) || d.replay?.lineCount !== 10 || !Array.isArray(paid) || !Array.isArray(frame.wins) ||
        ![frame.betAmount,frame.winAmount,frame.totalWinAmount,frame.balance,d.rawPayout].every(n=>Number.isSafeInteger(n)&&n>=0) ||
        frame.betAmount <= 0 || frame.totalWinAmount !== frame.winAmount || (d.stagesRemaining && frame.winAmount !== 0) ||
        d.jackpot !== jackpot || d.fullBoard !== (full || jackpot) || d.fullBoardMultiplier !== (full || jackpot ? 10 : 1) ||
        ((full || jackpot) && d.fullSymbolId !== (jackpot ? 7 : normal[0])) ||
        paid.length !== (jackpot ? 1 : d.lineWins.length) || paid.length !== frame.wins.length)
        throw new Error('Invalid AG7 frame');
    const pay = (p: PaidItem) => {
        const n = Number(p.amount);
        if (typeof p.amount !== 'string' || !/^\d+$/.test(p.amount) || !Number.isSafeInteger(n)) throw new Error('Invalid AG7 paid amount');
        return n;
    };
    if (paid.reduce((sum,p)=>sum+pay(p),0)!==frame.winAmount ||
        d.rawPayout !== (jackpot ? 20000 : d.lineWins.reduce((sum,w)=>sum+w.payout,0)))
        throw new Error('Invalid AG7 payout');
    if (jackpot && (d.lineWins.length || paid[0].rawPayout !== '20000' || paid[0].symbolId !== 7 ||
        frame.wins[0].symbolId !== 7 || frame.wins[0].cellIds.join() !== '1,2,3,4,5,6,7,8,9,10'))
        throw new Error('Invalid AG7 jackpot');
    const seen = new Set<number>();
    const awards = d.lineWins.map((line,i)=>{
        const payout = paid[i], win = frame.wins[i];
        if (seen.has(line.line) || LINES[line.line-1]?.join()!==line.cellIds.join() ||
            line.cellIds.join()!==win.cellIds.join() || line.symbolId!==win.symbolId || line.symbolId!==payout.symbolId ||
            PAYOUTS[line.symbolId-1] * d.fullBoardMultiplier!==line.payout || String(line.payout)!==payout.rawPayout)
            throw new Error('Invalid AG7 line award');
        seen.add(line.line);
        return {flag_id:line.line,mIconIdxs:line.cellIds.map(originalCell),mMoney:pay(payout),mWinOdds:line.payout};
    });
    if (jackpot) awards.push({flag_id:0,mIconIdxs:[...slots],mMoney:pay(paid[0]),mWinOdds:20000});
    return {rotate:{mIcons:icons,mAwardList:awards}};
}
