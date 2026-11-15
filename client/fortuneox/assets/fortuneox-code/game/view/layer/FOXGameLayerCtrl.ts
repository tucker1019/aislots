import { _decorator, Director, director, find } from 'cc';
import { xNodeFOX } from '../../../xtools/xNodeFOX';
import { FOXBaseNode } from '../../base/FOXBaseNode';
import { FOXSTATE } from '../../FOXConstant/FOXConstant';
import FOXLoadManager from '../../load/FOXLoadManager';
import { FOXGameManager } from '../../mgr/FOXGameManager';
import { goSession, Replay, Stake } from '../../net/FOXGoSession';
import { boardToIcons, defaultBoard, Frame, toOriginalSpin } from '../../net/FOXResultAdapter';
import { exitGame, promptGame, toast } from '../../net/FOXGameUI';
import { RetryBubble } from '../../ui/retry_bubble';
import { closeGameDialogs } from '../../ui/game_dialogs';
import { ReplayControls } from '../../history/replay_controls';
import { shareFromParent } from '../../history/native_replay_bridge';
import { FOXBetHistory } from '../../history/FOXBetHistory';
import FOXCenterRollCtrl from './FOXCenterRollCtrl';
import { FOXAudioMgr } from './FOXAudioMgr';
import { FOXGlobal } from './FOXGlobal';
import { FOXOptCtrl } from './FOXOptCtrl';

@_decorator.ccclass('FOXGameLayerCtrl')
export class FOXGameLayerCtrl extends FOXBaseNode {
    centerRollCtrl: FOXCenterRollCtrl = null;
    optCtrl: FOXOptCtrl = null;
    sysAutoNum = 0;
    afterFirstBoardDraw?: () => void;
    private replay?: Replay;
    private replayIndex = 0;
    private historyPage?: FOXBetHistory;
    private replayControls?: ReplayControls;
    private nativeReplay = new URLSearchParams(location.search).get('nativeReplay');
    private current?: Frame;
    private inGameRequest = false;
    private retryBubble?: RetryBubble;

    get isReplay() { return !!this.replay; }


    protected initAttribute() {
        this.centerRollCtrl = xNodeFOX.findComponent('layout_center', this.node, FOXCenterRollCtrl);
        this.optCtrl = xNodeFOX.findComponent('layout_bottom', this.node, FOXOptCtrl);
    }

    start() {
        this.initAttribute();
        const entry = goSession.entry;
        if (!entry) return;
        const {policy, state, replay} = entry;
        this.replay = replay;
        this.retryBubble = new RetryBubble(document.getElementById('GameCanvas') as HTMLCanvasElement);
        goSession.onRetry = (attempt, delay) => this.retryBubble?.update(attempt, delay);
        FOXGameManager.lineCount = policy.lineCount;
        FOXGameManager.betLevel = policy.betLevel;
        FOXGameManager.setMultiples(policy.betOptions.map(Number));
        FOXGameManager.setAllMultiples(policy.betOptions.map(bet => Number(bet) * policy.lineCount));
        FOXGameManager.setTotalBitList();
        this.optCtrl.canSendSpin = false;
        this.scheduleOnce(() => {
            if (!this.isValid) return;
            FOXLoadManager.ins.hideLoading();
            FOXAudioMgr.Instance.playMusic();
            if (replay) {
                this.startReplay(replay);
                this.afterInitialDraw(() => {
                    if (this.nativeReplay) this.notifyReplayParent('playing');
                });
                return;
            }
            const index = FOXGameManager.getTotalBitList().indexOf(Number(policy.defaultBet) * policy.lineCount);
            FOXGameManager.setTotalBitIndex(Math.max(index, 0));
            const defaultIndex = policy.betOptions.indexOf(policy.defaultBet);
            if (defaultIndex >= 0) {
                FOXGameManager.setBitIndex(defaultIndex);
                FOXGameManager.setBitMultIndex(0);
            }
            this.optCtrl.updateBitView();
            this.applyBalance(state.balance);
            this.restoreFrame(state.lastFrame);
            if (state.hasNext) {
                FOXGameManager.visualStake = state.lastFrame.betAmount;
                this.optCtrl.updateBitView();
                FOXGameManager.setState(FOXSTATE.RUNING);
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
        const priorStake = FOXGameManager.visualStake;
        if (frame) FOXGameManager.visualStake = frame.betAmount;
        this.centerRollCtrl.showStoredBoard(icons);
        FOXGameManager.visualStake = priorStake;
        FOXGameManager.setWinAllMoneyR(frame?.totalWinAmount || 0);
        FOXGameManager.setWinMoney(frame?.totalWinAmount || 0);
        this.optCtrl.setAwardNum(frame?.totalWinAmount || 0);
        if (frame?.nextAction === 'complete') {
            const awards = toOriginalSpin(frame).rotate.mAwardList;
            if (awards?.length) {
                this.centerRollCtrl.showSlotsGray(true);
                this.centerRollCtrl.showWinTrace(awards, awards.length, frame.gameData.fullBoard && !frame.gameData.jackpot);
            }
        }
    }

    private applyBalance(balance: number) {
        if (!this.replay) FOXGlobal.USER.gold = balance;
        this.optCtrl.setAllNum();
    }

    showSettledBalance(seconds: number) {
        if (!this.replay && this.current) {
            FOXGlobal.USER.gold = this.current.balance;
            this.optCtrl.rollBalance(this.current.balance, seconds);
        }
    }

    get stake(): Stake {
        return goSession.pendingStake || {bet: String(FOXGameManager.getBitNum()), betLevel: FOXGameManager.getBitMultIndex() + 1};
    }

    canAffordSpin() {
        const stake = this.stake;
        return !!goSession.pendingStake || FOXGlobal.USER.gold >= Number(stake.bet) * stake.betLevel * FOXGameManager.lineCount;
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
                this.replayControls?.progress(this.replayIndex, this.replay.frames.length, frame.mode === 'respin');
                this.replayIndex++;
            }
            if (!this.replay && !special) this.applyBalance(frame.balance - frame.winAmount);
            this.current = frame;
            FOXGameManager.visualStake = frame.betAmount;
            FOXGameManager.setRotateData(rotate);
            FOXGameManager.setWinAllMoney(frame.totalWinAmount);
            FOXGameManager.setWinAllMoneyR(frame.totalWinAmount);
            if (frame.nextAction === 'continue') this.applyBalance(frame.balance);
            this.centerRollCtrl.acceptFrame(frame);
        } catch (error) {
            if (!this.isValid) return;
            console.error('[AG7] spin', error);
            FOXGameManager.setAudoNum(0);
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
                FOXGameManager.visualStake = undefined;
                FOXGameManager.setState(FOXSTATE.READY);
                this.optCtrl.updateBtnState(true);
            }
            promptGame('请求失败', message, actions, 'failure');
        } finally { this.inGameRequest = false; }
    }

    handleAnimationError(error: unknown) {
        console.error('[AG7] animation', error);
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
        if (restoring) this.centerRollCtrl.restoreSpecial();
        this.centerRollCtrl.startSpecialRotation();
        await this.receive(true);
    }

    onPlayFinished() {
        if (this.current) this.applyBalance(this.current.balance);
        this.optCtrl.canSendSpin = !this.replay;
        FOXGameManager.visualStake = undefined;
        if (!this.replay) {
            this.optCtrl.updateBitView();
            FOXGameManager.setAudoNum(Math.max(0, FOXGameManager.getAudoNum() - 1));
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
        FOXGameManager.restRound();
        FOXGameManager.visualStake = replay.frames[0].betAmount;
        this.centerRollCtrl.showStoredBoard(boardToIcons(replay.startBoard?.length ? replay.startBoard : defaultBoard).icons);
        this.optCtrl.updateBitView();
        this.optCtrl.setAwardNum(0);
        this.optCtrl.setAllNum();
        this.optCtrl.canSendSpin = false;
        this.optCtrl.updateBtnState(false);
        this.scheduleOnce(() => {
            FOXGameManager.setState(FOXSTATE.RUNING);
            this.centerRollCtrl.startRotation();
            void this.receive(false);
        }, 0.5);
    }

    private notifyReplayParent(kind: 'playing' | 'exit') {
        window.parent.postMessage({type: 'ag7-replay-' + kind, channel: this.nativeReplay}, location.origin);
    }

    showHistory() {
        if (this.replay || FOXGameManager.getState() !== FOXSTATE.READY || !this.optCtrl.canSendSpin ||
            FOXGameManager.getAudoNum() > 0) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.historyPage ??= new FOXBetHistory(canvas, goSession.entry.policy.currency)).open();
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
        if (FOXGameManager.getState() === FOXSTATE.READY || this.replay) exitGame();
        else toast('游戏尚未结束，请稍候。');
    }
}
