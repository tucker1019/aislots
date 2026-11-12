import { Component, _decorator, isValid } from 'cc';
import { GameApi } from '../../network/game_api';
import { resolveApiBase } from '../../network/launch_session';
import { Frame, Progress } from '../../network/game_types';
import { retryRequest } from '../../network/error_overlay';
import { wbsgame } from '../wbsgame';
const { ccclass } = _decorator;
@ccclass('WBSSendManager')
export class WBSSendManager extends Component {
    api: GameApi;
    progress: Progress;
    readOnly = false;
    private disposed = false;
    private hideError: () => void;
    private lockedBet = 0;
    private lockedLevel = 1;
    protected onLoad() { const base = resolveApiBase(location.href); this.api = new GameApi(base); }
    protected onDestroy() { this.disposed = true; this.hideError?.(); }
    async bootstrap() {
        const params = new URLSearchParams(location.search);
        if (params.has("share") || params.has("replay")) {
            if (!params.get("share") || !params.get("replay"))
                throw Error("Invalid replay link");
            this.readOnly = true;
            this.progress = { requestId: "", balance: 0, hasNext: false };
            wbsgame.gameMgr.setMultiples([10]);
            wbsgame.gameMgr.setAllMultiples([200]);
            wbsgame.gameMgr.setTotalBitList();
            return;
        }
        await this.retry(() => this.api.login());
        const config = await this.retry(() => this.api.config());
        const mgr = wbsgame.gameMgr;
        mgr.betLevelLimit = config.betLevel;
        mgr.setMultiples(config.betOptions.map(Number));
        mgr.setAllMultiples(config.betOptions.map(v => Number(v) * config.lineCount));
        mgr.setTotalBitList();
        this.progress = await this.retry(() => this.api.state());
        mgr.getUserData().coin = this.progress.balance;
        mgr.setMoney(this.progress.balance);
        if (this.progress.hasNext && this.progress.betAmount) {
            const list = mgr.getTotalBitList();
            const idx = list.indexOf(this.progress.betAmount);
            if (idx < 0)
                throw Error('Saved wager is not available');
            mgr.setTotalBitIndex(idx);
        }
        this.lockedBet = mgr.getBitNum();
        this.lockedLevel = mgr.getBitMultIndex() + 1;
    }
    async retry<T>(operation: () => Promise<T>): Promise<T> {
        for (;;) {
            try {
                return await operation();
            }
            catch (error) {
                if (this.disposed)
                    throw error;
                await new Promise<void>(resolve => { this.hideError = retryRequest(error, resolve, () => wbsgame.platformMgr.exitToPlatform()); });
                if (this.disposed)
                    throw Error('Scene closed');
            }
        }
    }
    async sendGo() { this.lockedBet = wbsgame.gameMgr.getBitNum(); this.lockedLevel = wbsgame.gameMgr.getBitMultIndex() + 1; return this.nextFrame(); }
    async nextFrame(): Promise<Frame> {
        if (this.readOnly)
            throw Error("Replay is read-only");
        const frame = await this.retry(() => this.api.spin(this.lockedBet, this.lockedLevel));
        if (this.disposed)
            throw Error('Scene closed');
        wbsgame.gameMgr.applyFrame(frame);
        if (isValid(wbsgame.gamelayer))
            wbsgame.gamelayer.myGoldBottom?.setString(frame.balance);
        return frame;
    }
    sendRequestExitRoom() { wbsgame.platformMgr.exitToPlatform(); }
}
