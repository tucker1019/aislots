import { HistoryPage } from './history_page';
import { gameBounds } from './history_model';
import { HistoryClient, HistoryReplay } from './history_types';
import { GameApi } from '../network/game_api';
import { NativeReplayFrame } from './native_replay_frame';
import { loadAg3Replay } from './replay_data';
export { loadAg3Replay } from './replay_data';
import { replayShareURL } from './replay_share';
export class Ag3History {
    private page: HistoryPage;
    private replay: NativeReplayFrame;
    private disposed = false;
    private restoreAudio: (() => void) | null = null;
    constructor(private api: GameApi, private image: (symbol: number) => string, private pauseAudio: () => (() => void) = () => () => {}) {
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        this.page = new HistoryPage(api, canvas, () => gameBounds(canvas.getBoundingClientRect()), async () => {
            const art: Record<string,string> = {gold_frame:this.image(0)};
            for (let id=1;id<=10;id++) { art[String(id)]=this.image(id); art[String(1000+id)]=this.image(id); }
            return art;
        }, 'IDR', async (record) => {
            const data = await loadAg3Replay(api, record.betId);
            if (!this.page.isOpen)
                return;
            this.page.close();
            this.restoreAudio = this.pauseAudio();
            this.replay = new NativeReplayFrame(data, () => { this.replay = null; this.restoreAudio?.(); this.restoreAudio=null; if (!this.disposed)
                this.page.open(true); }, () => this.share(record.betId));
        }, record => this.share(record.betId));
    }
    private async share(id: string) { const result = await this.api.createReplayShare(id); return replayShareURL(location.href, id, result.shareToken); }
    open() { this.page.open(); }

    destroy() { this.disposed = true; this.replay?.destroy(); this.page.destroy(); }
}
