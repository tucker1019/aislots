import type { Frame } from '../network/game/game_api';
import type { HistoryClient, HistoryReplay } from './history_types';

/** 仅读已提交的历史帧；分页必须属于同一交易，且保持服务端的结算顺序。 */
export async function loadReplay(
    api: Pick<HistoryClient, 'historyReplay'>,
    betId: string,
    isCurrent: () => boolean = () => true,
): Promise<HistoryReplay> {
    let result: HistoryReplay = null;
    let cursor: string;
    const cursors = new Set<string>();
    do {
        if (!isCurrent()) throw new Error("Rekaman dibatalkan.");
        const page = await api.historyReplay(betId, cursor);
        if (!isCurrent()) throw new Error("Rekaman dibatalkan.");
        if (page.bet.betId !== betId || page.frames.some(frame => frame.betId !== betId))
            throw new Error("Transaksi rekaman tidak cocok.");
        if (!result) result = { ...page, frames: [] };
        for (const frame of page.frames) {
            const previous = result.frames[result.frames.length - 1];
            if (previous && (frame.spinIndex < previous.spinIndex ||
                (frame.spinIndex === previous.spinIndex && frame.stepIndex <= previous.stepIndex)))
                throw new Error("Urutan hasil rekaman tidak valid.");
            result.frames.push(frame);
        }
        cursor = page.nextCursor;
        if (cursor && cursors.has(cursor)) throw new Error("Halaman rekaman berulang.");
        if (cursor) cursors.add(cursor);
    } while (cursor);
    if (!result.frames.length) throw new Error("Belum ada hasil yang diselesaikan.");
    return { ...result, nextCursor: undefined };
}

/** 与 GameApi 的下一请求标识完全隔离；空标识只用于兼容现有动画帧类型。 */
export class ReplaySession {
    active = true;
    index = 0;
    readonly frames: Frame[];
    constructor(frames: HistoryReplay['frames']) {
        this.frames = frames.map(frame => ({ ...frame, requestId: '', nextRequestId: '' }));
    }
    get current() { return this.active ? this.frames[this.index] : undefined; }
    advance() { if (!this.active) return undefined; this.index++; return this.current; }
    cancel() { this.active = false; }
}
