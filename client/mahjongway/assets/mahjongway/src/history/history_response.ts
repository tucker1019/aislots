import type { HistoryList, HistoryReplay } from './history_types';

const incompatible = () => new Error('记录接口数据不完整，请重启当前连接的 Go 服务后重试');
const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object';
const amount = (value: unknown): value is string =>
    typeof value === 'string' && /^-?\d+$/.test(value);
function record(value: unknown) {
    return object(value) && typeof value.betId === 'string' &&
        amount(value.betAmount) && amount(value.totalWinAmount) && amount(value.profitAmount) &&
        Number.isInteger(value.winningRoundCount) && Number.isInteger(value.totalRoundCount);
}
/** 在网络边界拦截旧版或不完整响应，不能用分页小计冒充全量汇总。 */
export function historyListResponse(value: unknown): HistoryList {
    if (!object(value) || !Array.isArray(value.items) || !value.items.every(record) ||
        !Number.isInteger(value.amountScale) || !object(value.summary) ||
        !Number.isInteger(value.summary.recordCount) || !amount(value.summary.betAmount) ||
        !amount(value.summary.totalWinAmount) || !amount(value.summary.profitAmount)) {
        throw incompatible();
    }
    return value as unknown as HistoryList;
}
export function historyReplayResponse(value: unknown): HistoryReplay {
    if (!object(value) || !record(value.bet) || !Number.isInteger(value.amountScale) ||
        (value.startBoard !== undefined && (!Array.isArray(value.startBoard) || value.startBoard.length !== 5)) ||
        (value.startBottomSymbols !== undefined && (!value.startBoard || !Array.isArray(value.startBottomSymbols) ||
            value.startBottomSymbols.length !== 5 || !value.startBottomSymbols.every(n => Number.isSafeInteger(n)))) ||
        !Array.isArray(value.frames) || !value.frames.every(frame => object(frame) &&
            amount(frame.chargeAmount) && amount(frame.profitAmount) &&
            Array.isArray(frame.payouts) && Array.isArray(frame.board) && Array.isArray(frame.wins))) {
        throw incompatible();
    }
    return value as unknown as HistoryReplay;
}
