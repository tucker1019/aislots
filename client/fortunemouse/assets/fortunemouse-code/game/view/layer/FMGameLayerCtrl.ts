import { _decorator, Director, director, find } from 'cc';
import { xNodeFM } from '../../../xtools/xNodeFM';
import { FMBaseNode } from '../../base/FMBaseNode';
import { translateAll } from '../../common/FMUtils';
import { FMSTATE } from '../../FMConstant/FMConstant';
import FMLoadManager from '../../load/FMLoadManager';
import { FMGameManager } from '../../mgr/FMGameManager';
import { goSession, Replay, Stake } from '../../net/FMGoSession';
import { boardToIcons, defaultBoard, Frame, toOriginalSpin } from '../../net/FMResultAdapter';
import { exitGame, promptGame, toast } from '../../net/FMGameUI';
import { closeGameDialogs } from '../../ui/game_dialogs';
import { ReplayControls } from '../../history/replay_controls';
import { shareFromParent } from '../../history/native_replay_bridge';
import { FMBetHistory } from '../../history/FMBetHistory';
import FMCenterRollCtrl from './FMCenterRollCtrl';
import { FMAudioMgr } from './FMAudioMgr';
import { FMGlobal } from './FMGlobal';
import { FMOptCtrl } from './FMOptCtrl';

@_decorator.ccclass('FMGameLayerCtrl')
export class FMGameLayerCtrl extends FMBaseNode {
    centerRollCtrl: FMCenterRollCtrl = null;
    optCtrl: FMOptCtrl = null;
    sysAutoNum = 0;
    afterFirstBoardDraw?: () => void;
    private replay?: Replay;
    private replayIndex = 0;
    private historyPage?: FMBetHistory;
    private replayControls?: ReplayControls;
    private nativeReplay = new URLSearchParams(location.search).get('nativeReplay');
    private current?: Frame;
    private inGameRequest = false;

    get isReplay() { return !!this.replay; }

    onLoad() { translateAll(this.node); }

    protected initAttribute() {
        this.centerRollCtrl = xNodeFM.findComponent('layout_center', this.node, FMCenterRollCtrl);
        this.optCtrl = xNodeFM.findComponent('layout_bottom', this.node, FMOptCtrl);
    }

    start() {
        this.initAttribute();
        const entry = goSession.entry;
        if (!entry) return;
        const {policy, state, replay} = entry;
        this.replay = replay;
        FMGameManager.lineCount = policy.lineCount;
        FMGameManager.betLevel = policy.betLevel;
        FMGameManager.setMultiples(policy.betOptions.map(Number));
        FMGameManager.setAllMultiples(policy.betOptions.map(bet => Number(bet) * policy.lineCount));
        FMGameManager.setTotalBitList();
        this.optCtrl.canSendSpin = false;
        this.scheduleOnce(() => {
            if (!this.isValid) return;
            FMLoadManager.ins.hideLoading();
            FMAudioMgr.Instance.playMusic();
            if (replay) {
                this.startReplay(replay);
                this.afterInitialDraw(() => {
                    if (this.nativeReplay) this.notifyReplayParent('playing');
                });
                return;
            }
            const index = FMGameManager.getTotalBitList().indexOf(Number(policy.defaultBet) * policy.lineCount);
            FMGameManager.setTotalBitIndex(Math.max(index, 0));
            this.optCtrl.updateBitView();
            this.applyBalance(state.balance);
            this.restoreFrame(state.lastFrame);
            if (state.hasNext) {
                FMGameManager.visualStake = state.lastFrame.betAmount;
                this.optCtrl.updateBitView();
                FMGameManager.setState(FMSTATE.RUNING);
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
        const priorStake = FMGameManager.visualStake;
        if (frame) FMGameManager.visualStake = frame.betAmount;
        this.centerRollCtrl.showStoredBoard(icons);
        FMGameManager.visualStake = priorStake;
        FMGameManager.setWinAllMoneyR(frame?.totalWinAmount || 0);
        FMGameManager.setWinMoney(frame?.totalWinAmount || 0);
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
        if (!this.replay) FMGlobal.USER.gold = balance;
        this.optCtrl.setAllNum();
    }

    get stake(): Stake {
        return goSession.pendingStake || {bet: String(FMGameManager.getBitNum()), betLevel: FMGameManager.getBitMultIndex() + 1};
    }

    canAffordSpin() {
        const stake = this.stake;
        return !!goSession.pendingStake || FMGlobal.USER.gold >= Number(stake.bet) * stake.betLevel * FMGameManager.lineCount;
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
            this.current = frame;
            FMGameManager.visualStake = frame.betAmount;
            FMGameManager.setRotateData(rotate);
            FMGameManager.setWinAllMoney(frame.totalWinAmount);
            FMGameManager.setWinAllMoneyR(frame.totalWinAmount);
            if (frame.nextAction === 'continue') this.applyBalance(frame.balance);
            this.centerRollCtrl.acceptFrame(frame);
        } catch (error) {
            if (!this.isValid) return;
            console.error('[AG6] spin', error);
            this.centerRollCtrl.cancelRoll(boardToIcons(this.current?.board || defaultBoard).icons);
            FMGameManager.setAudoNum(0);
            this.restoreFrame(this.current);
            if (this.replay) { this.handleAnimationError(error); return; }
            const expired = error.status === 401;
            const message = expired ? "Sesi berakhir. Silakan masuk kembali dari lobi." : error.definitive ? error.message : "Koneksi bermasalah. Silakan coba lagi.";
            if (special || expired || error.status === 409) {
                const actions = [{label:"Kembali ke lobi", run: exitGame}];
                if (!expired && error.status !== 409) actions.unshift({label:"Coba lagi", run: () => {
                    this.centerRollCtrl.restoreSpecial();
                    this.centerRollCtrl.startSpecialRotation();
                    void this.receive(true);
                }});
                if (error.status === 409) actions.unshift({label:"Hubungkan lagi", run: () => location.reload()});
                promptGame("Game Dijeda", message, actions);
            } else {
                toast(message);
                FMGameManager.visualStake = undefined;
                FMGameManager.setState(FMSTATE.READY);
                this.optCtrl.updateBtnState(true);
                this.optCtrl.canSendSpin = true;
            }
        } finally { this.inGameRequest = false; }
    }

    handleAnimationError(error: unknown) {
        console.error('[AG6] animation', error);
        if (this.replay) {
            toast("Gagal memutar rekaman. Silakan coba lagi.");
            this.replayControls?.done("Rekaman Gagal");
            return;
        }
        promptGame("Game Dijeda", "Gagal memulihkan tampilan game. Silakan hubungkan kembali.", [
            {label:"Hubungkan lagi", run: () => location.reload()}, {label:"Kembali ke lobi", run: exitGame},
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
        FMGameManager.visualStake = undefined;
        if (!this.replay) {
            this.optCtrl.updateBitView();
            FMGameManager.setAudoNum(Math.max(0, FMGameManager.getAudoNum() - 1));
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
        FMGameManager.restRound();
        FMGameManager.visualStake = replay.frames[0].betAmount;
        this.centerRollCtrl.showStoredBoard(boardToIcons(replay.startBoard?.length ? replay.startBoard : defaultBoard).icons);
        this.optCtrl.updateBitView();
        this.optCtrl.setAwardNum(0);
        this.optCtrl.setAllNum();
        this.optCtrl.canSendSpin = false;
        this.optCtrl.updateBtnState(false);
        this.scheduleOnce(() => {
            FMGameManager.setState(FMSTATE.RUNING);
            this.centerRollCtrl.startRotation();
            void this.receive(false);
        }, 0.5);
    }

    private notifyReplayParent(kind: 'playing' | 'exit') {
        window.parent.postMessage({type: 'ag6-replay-' + kind, channel: this.nativeReplay}, location.origin);
    }

    showHistory() {
        if (this.replay || FMGameManager.getState() !== FMSTATE.READY || !this.optCtrl.canSendSpin ||
            FMGameManager.getAudoNum() > 0) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.historyPage ??= new FMBetHistory(canvas, goSession.entry.policy.currency)).open();
    }

    onDestroy() {
        this.historyPage?.destroy();
        this.replayControls?.destroy();
        closeGameDialogs();
        super.onDestroy();
    }

    onBtnMenu() { this.optCtrl.onMenuClick(); }
    onBtnShop() { toast("Silakan kembali ke lobi untuk deposit."); }
    onBtnExit() {
        if (FMGameManager.getState() === FMSTATE.READY || this.replay) exitGame();
        else toast("Game belum selesai. Mohon tunggu.");
    }
}
