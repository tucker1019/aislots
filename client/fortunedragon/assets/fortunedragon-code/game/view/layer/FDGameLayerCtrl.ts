import { _decorator, Director, director, find } from 'cc';
import { xNodeFD } from '../../../xtools/xNodeFD';
import { FDBaseNode } from '../../base/FDBaseNode';
import { FDSTATE } from '../../FDConstant/FDConstant';
import FDLoadManager from '../../load/FDLoadManager';
import { FDGameManager } from '../../mgr/FDGameManager';
import { goSession, Replay, Stake } from '../../net/FDGoSession';
import { boardToIcons, defaultBoard, Frame, toOriginalSpin, wagerAmount } from '../../net/FDResultAdapter';
import { exitGame, promptGame, toast } from '../../net/FDGameUI';
import { RetryBubble } from '../../ui/retry_bubble';
import { closeGameDialogs } from '../../ui/game_dialogs';
import { ReplayControls } from '../../history/replay_controls';
import { shareFromParent } from '../../history/native_replay_bridge';
import { FDBetHistory } from '../../history/FDBetHistory';
import FDCenterRollCtrl from './FDCenterRollCtrl';
import { FDAudioMgr } from './FDAudioMgr';
import { FDGlobal } from './FDGlobal';
import { FDOptCtrl } from './FDOptCtrl';

@_decorator.ccclass('FDGameLayerCtrl')
export class FDGameLayerCtrl extends FDBaseNode {
    centerRollCtrl: FDCenterRollCtrl = null;
    optCtrl: FDOptCtrl = null;
    sysAutoNum = 0;
    afterFirstBoardDraw?: () => void;
    private replay?: Replay;
    private replayIndex = 0;
    private historyPage?: FDBetHistory;
    private replayControls?: ReplayControls;
    private nativeReplay = new URLSearchParams(location.search).get('nativeReplay');
    private current?: Frame;
    private inGameRequest = false;
    private retryBubble?: RetryBubble;

    get frame() { return this.current; }
    get canBoost() { return goSession.entry?.policy.buyModes?.some(m => m.buyMode === 2 && m.betMultiplier === 5); }

    get isReplay() { return !!this.replay; }


    protected initAttribute() {
        this.centerRollCtrl = xNodeFD.findComponent('layout_center', this.node, FDCenterRollCtrl);
        this.optCtrl = xNodeFD.findComponent('layout_bottom', this.node, FDOptCtrl);
    }

    start() {
        this.initAttribute();
        const entry = goSession.entry;
        if (!entry) return;
        const {policy, state, replay} = entry;
        this.replay = replay;
        this.retryBubble = new RetryBubble(document.getElementById('GameCanvas') as HTMLCanvasElement);
        goSession.onRetry = (attempt, delay) => this.retryBubble?.update(attempt, delay);
        FDGameManager.lineCount = policy.lineCount;
        FDGameManager.betLevel = policy.betLevel;
        FDGameManager.setMultiples(policy.betOptions.map(Number));
        FDGameManager.setAllMultiples(policy.betOptions.map(bet => Number(bet) * policy.lineCount));
        FDGameManager.setTotalBitList();
        this.optCtrl.canSendSpin = false;
        this.scheduleOnce(() => {
            if (!this.isValid) return;
            FDLoadManager.ins.hideLoading();
            FDAudioMgr.Instance.playMusic('bgm_mg_intro', false);
            FDAudioMgr.Instance.setMusicComplete(() => FDAudioMgr.Instance.playMusic());
            if (replay) {
                this.startReplay(replay);
                this.afterInitialDraw(() => {
                    if (this.nativeReplay) this.notifyReplayParent('playing');
                });
                return;
            }
            const index = FDGameManager.getTotalBitList().indexOf(Number(policy.defaultBet) * policy.lineCount);
            FDGameManager.setTotalBitIndex(Math.max(index, 0));
            const defaultIndex = policy.betOptions.indexOf(policy.defaultBet);
            if (defaultIndex >= 0) {
                FDGameManager.setBitIndex(defaultIndex);
                FDGameManager.setBitMultIndex(0);
            }
            this.optCtrl.updateBitView();
            this.applyBalance(state.balance);
            if (state.lastFrame) this.centerRollCtrl.setAntMode(state.lastFrame.buyMode === 2, false);
            this.restoreFrame(state.lastFrame);
            this.optCtrl.updateBitView();
            if (state.hasNext) {
                FDGameManager.visualStake = state.lastFrame.betAmount;
                this.optCtrl.updateBitView();
                FDGameManager.setState(FDSTATE.RUNING);
                this.optCtrl.updateBtnState(false);
                this.afterInitialDraw(() => {
                    void this.continuePlay(state.lastFrame, true).catch(error => this.handleAnimationError(error));
                });
            } else this.afterInitialDraw(() => { this.optCtrl.canSendSpin = true; });
        });
    }

    private afterInitialDraw(ready?: () => void) {
        director.once(Director.EVENT_AFTER_DRAW, () => {
            if (!this.isValid) return;
            this.afterFirstBoardDraw?.();
            this.afterFirstBoardDraw = undefined;
            ready?.();
        });
    }

    private restoreFrame(frame?: Frame) {
        this.current = frame;
        const icons = boardToIcons(frame?.board || defaultBoard).icons;
        const priorStake = FDGameManager.visualStake;
        if (frame) FDGameManager.visualStake = frame.betAmount;
        this.centerRollCtrl.showStoredBoard(icons, frame?.gameData, frame?.nextAction === 'continue' && frame.mode === 'free');
        FDGameManager.visualStake = priorStake;
        FDGameManager.setWinAllMoneyR(frame?.totalWinAmount || 0);
        FDGameManager.setWinMoney(frame?.totalWinAmount || 0);
        this.optCtrl.setAwardNum(frame?.totalWinAmount || 0);
        if (frame?.nextAction === 'complete') {
            const awards = toOriginalSpin(frame).rotate.mAwardList;
            if (awards?.length) {
                this.centerRollCtrl.showSlotsGray(true);
                this.centerRollCtrl.showWinTrace(awards, awards.length);
            }
        }
    }

    private applyBalance(balance: number) {
        if (!this.replay) FDGlobal.USER.gold = balance;
        this.optCtrl.setAllNum();
    }

    showSettledBalance(seconds: number) {
        if (!this.replay && this.current) {
            FDGlobal.USER.gold = this.current.balance;
            this.optCtrl.rollBalance(this.current.balance, seconds);
        }
    }

    get stake(): Stake {
        return goSession.pendingStake || {bet: String(FDGameManager.getBitNum()), betLevel: FDGameManager.getBitMultIndex() + 1, buyMode: FDGameManager.getIsAnt() ? 2 : 1};
    }

    canAffordSpin() {
        const stake = this.stake;
        return !!goSession.pendingStake || FDGlobal.USER.gold >= wagerAmount(stake.bet, stake.betLevel, FDGameManager.lineCount, stake.buyMode);
    }

    async playPaidSpin(stake: Stake) {
        await this.receive(false, stake);
    }

    private async receive(special: boolean, stake?: Stake) {
        if (this.inGameRequest) return;
        this.inGameRequest = true;
        try {
            const frame = this.replay ? this.replay.frames[this.replayIndex] : await goSession.spin(stake);
            if (!this.isValid) return;
            const {rotate} = toOriginalSpin(frame);
            if (this.replay) {
                this.replayControls?.progress(this.replayIndex, this.replay.frames.length, frame.mode === 'free');
                this.replayIndex++;
            }
            if (!this.replay && !special) this.applyBalance(frame.balance - frame.winAmount);
            this.current = frame;
            FDGameManager.visualStake = frame.betAmount;
            FDGameManager.setRotateData(rotate);
            FDGameManager.setWinAllMoney(frame.totalWinAmount);
            FDGameManager.setWinAllMoneyR(frame.totalWinAmount);
            this.centerRollCtrl.acceptFrame(frame);
        } catch (error) {
            if (!this.isValid) return;
            console.error('[AG8] spin', error);
            FDGameManager.setAudoNum(0);
            if (this.replay) { this.handleAnimationError(error); return; }
            const expired = error.status === 401;
            const message = expired ? '登录已过期，请从大厅重新进入。' : error.definitive ? error.message : '网络异常，请重试。';
            const actions = [{label:'返回大厅', run: exitGame}];
            if (!expired && error.status !== 409 && !error.definitive) actions.unshift({label:'重试', run: () => {
                void this.receive(special, stake);
            }});
            if (error.status === 409) actions.unshift({label:'重新连接', run: () => location.reload()});
            if (error.definitive && !special && !expired && error.status !== 409) {
                this.centerRollCtrl.cancelRoll(boardToIcons(this.current?.board || defaultBoard).icons);
                this.restoreFrame(this.current);
                FDGameManager.visualStake = undefined;
                FDGameManager.setState(FDSTATE.READY);
                this.optCtrl.updateBtnState(true);
            }
            promptGame('请求失败', message, actions, 'failure');
        } finally { this.inGameRequest = false; }
    }

    handleAnimationError(error: unknown) {
        console.error('[AG8] animation', error);
        if (this.replay) {
            toast('回放播放失败，请重试。');
            this.replayControls?.done('回放失败');
            return;
        }
        promptGame('游戏暂停', '游戏画面恢复失败，请重新连接。', [
            {label:'重新连接', run: () => location.reload()}, {label:'返回大厅', run: exitGame},
        ]);
    }

    async continuePlay(_frame: Frame, restoring = false) {
        if (!this.isValid) return;
        FDGameManager.setState(FDSTATE.FREEING);
        if (restoring) FDAudioMgr.Instance.playMusic('bgm_fs_loop');
        FDGameManager.setRotateData(null);
        this.centerRollCtrl.startRotation();
        await this.receive(true);
    }

    onPlayFinished() {
        if (this.current) this.applyBalance(this.current.balance);
        this.optCtrl.canSendSpin = !this.replay;
        FDGameManager.visualStake = undefined;
        if (!this.replay) {
            this.optCtrl.updateBitView();
            FDGameManager.setAudoNum(Math.max(0, FDGameManager.getAudoNum() - 1));
            this.optCtrl.checkAudo();
            return;
        }
        this.optCtrl.canSendSpin = false;
        this.optCtrl.updateBtnState(false);
        this.replayControls?.done();
    }

    private startReplay(replay: Replay) {
        this.replay = replay;
        this.replayIndex = 0;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        this.replayControls ??= new ReplayControls(canvas, replay.bet.betId,
            () => this.nativeReplay ? this.notifyReplayParent('exit') : exitGame(),
            {share: this.nativeReplay ? () => shareFromParent(this.nativeReplay) :
                !new URLSearchParams(location.search).has('share') ? () => goSession.shareReplay(replay.bet.betId) : undefined},
            () => this.startReplay(replay));
        this.replayControls.progress(0, replay.frames.length, false);
        this.current = undefined;
        FDGameManager.restRound();
        FDGameManager.visualStake = replay.frames[0].betAmount;
        this.centerRollCtrl.setAntMode(replay.frames[0].buyMode === 2, false);
        this.centerRollCtrl.showStoredBoard(boardToIcons(replay.startBoard?.length ? replay.startBoard : defaultBoard).icons);
        this.optCtrl.updateBitView();
        this.optCtrl.setAwardNum(0);
        this.optCtrl.setAllNum();
        this.optCtrl.canSendSpin = false;
        this.optCtrl.updateBtnState(false);
        this.scheduleOnce(() => {
            FDGameManager.setState(FDSTATE.RUNING);
            this.centerRollCtrl.startRotation();
            void this.receive(false);
        }, 0.5);
    }

    private notifyReplayParent(kind: 'playing' | 'exit') {
        window.parent.postMessage({type: 'ag8-replay-' + kind, channel: this.nativeReplay}, location.origin);
    }

    showHistory() {
        if (this.replay || FDGameManager.getState() !== FDSTATE.READY || !this.optCtrl.canSendSpin ||
            FDGameManager.getAudoNum() > 0) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.historyPage ??= new FDBetHistory(canvas, goSession.entry.policy.currency)).open();
    }

    onDestroy() {
        goSession.onRetry = undefined;
        this.retryBubble?.destroy();
        this.historyPage?.destroy();
        this.replayControls?.destroy();
        closeGameDialogs();
        super.onDestroy();
    }

    onBtnMenu() { this.optCtrl.onMenuClick(); }
    onBtnShop() { toast('请返回大厅充值。'); }
    onBtnExit() {
        if (FDGameManager.getState() === FDSTATE.READY || this.replay) exitGame();
        else toast('游戏尚未结束，请稍候。');
    }
}
