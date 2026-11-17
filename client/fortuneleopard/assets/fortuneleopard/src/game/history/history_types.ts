import type { GoFrame } from '../net/FLResultAdapter';
export interface HistoryRecord {
    betId: string;
    gameId: string;
    betAmount: string;
    totalWinAmount: string;
    profitAmount: string;
    winningRoundCount: number;
    totalRoundCount: number;
    status: 'active' | 'complete';
    country: string;
    currency: string;
    createdAt: string;
    updatedAt: string;
}
export interface HistorySummary {
    recordCount: number;
    betAmount: string;
    totalWinAmount: string;
    profitAmount: string;
}
export interface HistoryList {
    items: HistoryRecord[];
    summary: HistorySummary;
    amountScale: number;
    nextCursor?: string;
}
export interface HistoryPayout {
    symbolId: number;
    columns: number;
    ways: number;
    amount: string;
    rawPayout: string;
    symbolPayout?: string;
    multiplier?: string;
}
export type HistoryRound = GoFrame & {
    settledAt: string;
    spinIndex: number;
    previewRows?: number;
    cascadeIndex?: number;
    cascadeFactors?: string[];
    wins: unknown[];
    chargeAmount: string;
    profitAmount: string;
    lineCount?: number;
    payoutUnit?: string;
    payouts: HistoryPayout[];
};
export interface HistoryReplay {
    bet: HistoryRecord;
    frames: HistoryRound[];
    startBoard?: GoFrame['board'];
    amountScale: number;
    nextCursor?: string;
}
export interface HistoryQuery {
    from: string;
    to: string;
    cursor?: string;
}
export interface HistoryClient {
    historyRecords(query: HistoryQuery): Promise<HistoryList>;
    historyReplay(betId: string, cursor?: string): Promise<HistoryReplay>;
}
export type HistoryArt = Record<string, string>;
