import { NativeReplaySession } from '../../history/native_replay_session';
import { receiveNativeReplay } from '../../history/native_replay_bridge';
import { loadAg3Replay } from '../../history/replay_data';
import { adaptFrame } from '../../network/frame_adapter';
import { WBSConstant } from '../constant/WBSConstant';
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
    replaySession: NativeReplaySession | null = null;
    onReplayFrame: (() => void) | null = null;
    private disposed = false;
    private hideError: () => void;
    private lockedBet = 0;
    private lockedLevel = 1;
    protected onLoad() { const base = resolveApiBase(location.href); this.api = new GameApi(base); }
    protected onDestroy() { this.disposed = true; this.hideError?.(); }
    async bootstrap() {
        const params = new URLSearchParams(location.search);
        if (params.has("share") || params.has("replay") || params.has("nativeReplay")) {
            if (!params.has("nativeReplay") && (!params.get("share") || !params.get("replay")))
                throw Error("Invalid replay link");
            this.readOnly = true;
            this.progress = { requestId: "", balance: 0, hasNext: false };
            const data = params.has('nativeReplay') ? await receiveNativeReplay(params.get('nativeReplay')) : await loadAg3Replay({historyReplay:(id,cursor)=>this.api.sharedReplay(id,params.get('share'),cursor)},params.get('replay'));
            data.frames.forEach(frame=>adaptFrame({...frame,requestId:'',nextRequestId:''}));
            this.replaySession = new NativeReplaySession(data);
            const amount = Number(data.bet.betAmount);
            if (!Number.isSafeInteger(amount) || amount <= 0) throw Error('回放投注无效');
            wbsgame.gameMgr.getUserData().coin = 0;
            wbsgame.gameMgr.setMoney(0);
            wbsgame.gameMgr.betLevelLimit = 1;
            wbsgame.gameMgr.setMultiples([amount / WBSConstant.ALL_LINE]);
            wbsgame.gameMgr.setAllMultiples([amount]);
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
    async sendGo() { if (this.readOnly) throw Error("Replay is read-only"); this.lockedBet = wbsgame.gameMgr.getBitNum(); this.lockedLevel = wbsgame.gameMgr.getBitMultIndex() + 1; return this.nextFrame(); }
    async nextFrame(): Promise<Frame> {
        if (this.readOnly) {
            const frame = this.replaySession?.next();
            if (!frame) throw Error('没有更多已结算回放帧');
            wbsgame.gameMgr.applyFrame(frame);
            if (isValid(wbsgame.gamelayer)) wbsgame.gamelayer.myGoldBottom.string = '******';
            this.onReplayFrame?.();
            return frame;
        }
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
