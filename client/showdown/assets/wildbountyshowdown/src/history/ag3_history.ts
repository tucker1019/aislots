import { HistoryPage } from './history_page';
import { loadHistoryArt } from './history_assets';
import { gameBounds } from './history_model';
import { HistoryClient, HistoryReplay } from './history_types';
import { GameApi } from '../network/game_api';
import { Ag3Replay } from './ag3_replay';
import { replayShareURL } from './replay_share';
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
export class Ag3History {
    private page: HistoryPage;
    private replay: Ag3Replay;
    private disposed = false;
    constructor(private api: GameApi, private image: (symbol: number) => string) {
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        this.page = new HistoryPage(api, canvas, () => gameBounds(canvas.getBoundingClientRect()), loadHistoryArt, 'IDR', async (record) => {
            const data = await loadAg3Replay(api, record.betId);
            if (!this.page.isOpen)
                return;
            this.page.close();
            this.replay = new Ag3Replay(data, () => { this.replay = null; if (!this.disposed)
                this.page.open(true); }, () => this.share(record.betId), this.image);
        }, record => this.share(record.betId));
    }
    private async share(id: string) { const result = await this.api.createReplayShare(id); return replayShareURL(location.href, id, result.shareToken); }
    open() { this.page.open(); }
    async shared(id: string, share: string) { const data = await loadAg3Replay({ historyReplay: (id, cursor) => this.api.sharedReplay(id, share, cursor) }, id); if (this.disposed)
        return; this.replay = new Ag3Replay(data, () => history.back(), () => Promise.resolve(replayShareURL(location.href, id, share)), this.image); }
    destroy() { this.disposed = true; this.replay?.close(); this.page.destroy(); }
}
