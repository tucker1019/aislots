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
        if (!isCurrent()) throw new Error('回放已取消');
        const page = await api.historyReplay(betId, cursor);
        if (!isCurrent()) throw new Error('回放已取消');
        if (page.bet.betId !== betId || page.frames.some(frame => frame.betId !== betId))
            throw new Error('回放交易不一致');
        if (!result) result = { ...page, frames: [] };
        for (const frame of page.frames) {
            const previous = result.frames[result.frames.length - 1];
            if (previous && (frame.spinIndex < previous.spinIndex ||
                (frame.spinIndex === previous.spinIndex && frame.stepIndex <= previous.stepIndex)))
                throw new Error('回放盘面顺序无效');
            result.frames.push(frame);
        }
        cursor = page.nextCursor;
        if (cursor && cursors.has(cursor)) throw new Error('回放分页游标重复');
        if (cursor) cursors.add(cursor);
    } while (cursor);
    if (!result.frames.length) throw new Error('暂无已结算盘面');
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
