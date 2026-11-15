import { fmframe } from '../../fmframe/fmframe';
import { goSession } from '../net/FMGoSession';
import { loadHistoryArt } from './history_assets';
import { visibleGameBounds } from '../ui/game_overlay';
import { HistoryPage } from './history_page';
import { NativeReplayFrame } from './native_replay_frame';

export class FMBetHistory {
    private readonly page: HistoryPage;
    private replay?: NativeReplayFrame;
    private restoreAudio?: () => void;

    constructor(canvas: HTMLCanvasElement, currency: string) {
        this.page = new HistoryPage(goSession, canvas,
            () => visibleGameBounds(canvas), loadHistoryArt, currency,
            async record => {
                const data = await goSession.readReplay(record.betId);
                if (!this.page.isOpen) return;
                this.page.suspend();
                const audio = fmframe.audio;
                const playing = audio.isMusicPlaying();
                audio.pauseAll();
                this.restoreAudio = () => { if (playing && audio.getSwitchMusic()) audio.resumeMusic(); };
                this.replay = new NativeReplayFrame(data, () => {
                    this.replay = undefined;
                    this.restoreAudio?.();
                    this.restoreAudio = undefined;
                    this.page.resume();
                }, () => goSession.shareReplay(record.betId));
            }, record => goSession.shareReplay(record.betId));
    }

    open() { this.page.open(); }
    destroy() { this.replay?.destroy(); this.restoreAudio?.(); this.page.destroy(); }
}
