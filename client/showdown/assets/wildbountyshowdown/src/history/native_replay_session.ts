import type { HistoryReplay } from './history_types';
import type { Frame } from '../network/game_types';
/** A finite, immutable receipt stream. Never owns or advances a live request ID. */
export class NativeReplaySession {
    index = -1;
    private cycle = 1;
    constructor(readonly data: HistoryReplay) { if (!data.frames.length) throw Error('暂无已结算盘面'); }
    get length() { return this.data.frames.length; }
    restart() { this.index = -1; this.cycle++; }
    next(): Frame | undefined {
        if (this.index + 1 >= this.length) return undefined;
        const index = ++this.index, original = this.data.frames[index];
        const last = index === this.length - 1;
        return { ...original, requestId: `replay-${this.cycle}-${index}`, nextRequestId: '', balance: 0,
            ...(last ? {nextAction: 'complete' as const, triggeredFree: false, awardedFreeSpins: 0} : {}) };
    }
}
