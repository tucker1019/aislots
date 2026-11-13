import type { HistoryClient, HistoryReplay } from './history_types';
export async function loadAg3Replay(api: Pick<HistoryClient, 'historyReplay'>, id: string): Promise<HistoryReplay> {
    let result: HistoryReplay;
    let cursor: string;
    const seen = new Set<string>();
    do {
        const page = await api.historyReplay(id, cursor);
        if (page.bet.betId !== id || page.frames.some(f => f.betId !== id))
            throw Error('Replay order mismatch');
        if (!result)
            result = { ...page, frames: [] };
        for (const frame of page.frames) {
            const last = result.frames[result.frames.length - 1];
            if (last && (frame.spinIndex < last.spinIndex || frame.spinIndex === last.spinIndex && frame.stepIndex <= last.stepIndex))
                throw Error('Replay frame order mismatch');
            result.frames.push(frame);
        }
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
            throw Error('Repeated replay cursor');
        if (cursor)
            seen.add(cursor);
    } while (cursor);
    if (!result.frames.length)
        throw Error('No settled frames');
    return result;
}
