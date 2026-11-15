import { goSession } from '../net/FTGoSession';
import { ftframe } from '../../ftframe/ftframe';
import { HistoryPage } from './history_page';
import { loadHistoryArt } from './history_assets';
import { gameBounds } from './history_model';
import { loadAg4Replay } from './replay_data';
import { NativeReplayFrame } from './native_replay_frame';
import { replayShareURL } from './replay_share';

export class FTBetHistory {
    private page: HistoryPage;
    private replay?: NativeReplayFrame;
    private restoreAudio?: () => void;

    constructor(canvas: HTMLCanvasElement, currency: string) {
        this.page = new HistoryPage(goSession, canvas,
            () => gameBounds(canvas.getBoundingClientRect(), 750, 1334), loadHistoryArt, currency,
            async record => {
                const data = await loadAg4Replay(goSession, record.betId);
                if (!this.page.isOpen) return;
                this.page.suspend();
                const audio = ftframe.audio;
                const playing = audio.isMusicPlaying();
                audio.pauseAll();
                this.restoreAudio = () => { if (playing && audio.getSwitchMusic()) audio.resumeMusic(); };
                this.replay = new NativeReplayFrame(data, () => {
                    this.replay = undefined;
                    this.resumeAudio();
                    this.page.resume();
                }, () => this.share(record.betId));
            }, record => this.share(record.betId));
    }

    private async share(betId: string) {
        const { shareToken } = await goSession.shareReplay(betId);
        return replayShareURL(location.href, betId, shareToken);
    }

    open() { this.page.open(); }
    private resumeAudio() { this.restoreAudio?.(); this.restoreAudio = undefined; }
    destroy() { this.replay?.destroy(); this.resumeAudio(); this.page.destroy(); }
}
