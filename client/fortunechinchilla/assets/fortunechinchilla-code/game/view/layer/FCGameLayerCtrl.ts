import { _decorator, Director, director, find } from 'cc';
import { xNodeFC } from '../../../xtools/xNodeFC';
import { FCBaseNode } from '../../base/FCBaseNode';
import { translateAll } from '../../common/FCUtils';
import { FCSTATE } from '../../FCConstant/FCConstant';
import FCLoadManager from '../../load/FCLoadManager';
import { FCGameManager } from '../../mgr/FCGameManager';
import { goSession, Replay, Stake } from '../../net/FCGoSession';
import { boardToIcons, defaultBoard, Frame, toOriginalSpin } from '../../net/FCResultAdapter';
import { exitGame, promptGame, toast } from '../../net/FCGameUI';
import { closeGameDialogs } from '../../ui/game_dialogs';
import { ReplayControls } from '../../history/replay_controls';
import { shareFromParent } from '../../history/native_replay_bridge';
import { FCBetHistory } from '../../history/FCBetHistory';
import FCCenterRollCtrl from './FCCenterRollCtrl';
import { FCAudioMgr } from './FCAudioMgr';
import { FCGlobal } from './FCGlobal';
import { FCOptCtrl } from './FCOptCtrl';
import { FCPopupMenuCtrl } from './FCPopupMenuCtrl';

@_decorator.ccclass('FCGameLayerCtrl')
export class FCGameLayerCtrl extends FCBaseNode {
    centerRollCtrl: FCCenterRollCtrl = null;
    optCtrl: FCOptCtrl = null;
    popupMenuCtrl: FCPopupMenuCtrl = null;
    sysAutoNum = 0;
    afterFirstBoardDraw?: () => void;
    private replay?: Replay;
    private replayIndex = 0;
    private historyPage?: FCBetHistory;
    private replayControls?: ReplayControls;
    private nativeReplay = new URLSearchParams(location.search).get('nativeReplay');
    private current?: Frame;
    private inGameRequest = false;

    get isReplay() { return !!this.replay; }

    onLoad() { translateAll(this.node); }

    protected initAttribute() {
        this.centerRollCtrl = xNodeFC.findComponent('layout_center', this.node, FCCenterRollCtrl);
        this.optCtrl = xNodeFC.findComponent('layout_bottom', this.node, FCOptCtrl);
        this.popupMenuCtrl = find('Canvas/TopLayer/node_popup_menu').getComponent(FCPopupMenuCtrl);
    }

    start() {
        this.initAttribute();
        const entry = goSession.entry;
        if (!entry) return;
        const {policy, state, replay} = entry;
        this.replay = replay;
        FCGameManager.lineCount = policy.lineCount;
        FCGameManager.betLevel = policy.betLevel;
        FCGameManager.setMultiples(policy.betOptions.map(Number));
        FCGameManager.setAllMultiples(policy.betOptions.map(bet => Number(bet) * policy.lineCount));
        FCGameManager.setTotalBitList();
        this.optCtrl.canSendSpin = false;
        this.scheduleOnce(() => {
            if (!this.isValid) return;
            FCLoadManager.ins.hideLoading();
            FCAudioMgr.Instance.playMusic();
            if (replay) {
                this.startReplay(replay);
                this.afterInitialDraw(() => {
                    if (this.nativeReplay) this.notifyReplayParent('playing');
                });
                return;
            }
            const index = FCGameManager.getTotalBitList().indexOf(Number(policy.defaultBet) * policy.lineCount);
            FCGameManager.setTotalBitIndex(Math.max(index, 0));
            this.optCtrl.updateBitView();
            this.applyBalance(state.balance);
            this.restoreFrame(state.lastFrame);
            if (state.hasNext) {
                FCGameManager.visualStake = state.lastFrame.betAmount;
                this.optCtrl.updateBitView();
                FCGameManager.setState(FCSTATE.RUNNING);
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
        const priorStake = FCGameManager.visualStake;
        if (frame) FCGameManager.visualStake = frame.betAmount;
        this.centerRollCtrl.showStoredBoard(icons);
        FCGameManager.visualStake = priorStake;
        FCGameManager.setWinAllMoneyR(frame?.totalWinAmount || 0);
        FCGameManager.setWinMoney(frame?.totalWinAmount || 0);
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
        if (!this.replay) FCGlobal.USER.gold = balance;
        this.optCtrl.setAllNum();
    }

    get stake(): Stake {
        return goSession.pendingStake || {bet: String(FCGameManager.getBitNum()), betLevel: FCGameManager.getBitMultIndex() + 1};
    }

    canAffordSpin() {
        const stake = this.stake;
        return !!goSession.pendingStake || FCGlobal.USER.gold >= Number(stake.bet) * stake.betLevel * FCGameManager.lineCount;
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
            const {rotate, rewardAmounts} = toOriginalSpin(frame);
            if (this.replay) {
                this.replayControls?.progress(this.replayIndex, this.replay.frames.length, frame.mode === 'free');
                this.replayIndex++;
            }
            this.current = frame;
            FCGameManager.visualStake = frame.betAmount;
            FCGameManager.setRotateData(rotate);
            FCGameManager.setWinAllMoney(frame.totalWinAmount);
            FCGameManager.setWinAllMoneyR(frame.totalWinAmount);
            this.applyBalance(frame.balance);
            this.centerRollCtrl.acceptFrame(frame, rewardAmounts);
        } catch (error) {
            if (!this.isValid) return;
            console.error('[AG10] spin', error);
            this.centerRollCtrl.cancelRoll(boardToIcons(this.current?.board || defaultBoard).icons);
            FCGameManager.setAudoNum(0);
            this.restoreFrame(this.current);
            const expired = error.status === 401;
            const message = expired ? "Sesi berakhir. Silakan masuk kembali dari lobi." : error.definitive ? error.message : "Koneksi bermasalah. Silakan coba lagi.";
            if (special || expired || error.status === 409) {
                const actions = [{label:"Kembali ke lobi", run: exitGame}];
                if (!expired && error.status !== 409) actions.unshift({label:"Coba lagi", run: () => {
                    this.centerRollCtrl.startSpecialRotation();
                    void this.receive(true);
                }});
                if (error.status === 409) actions.unshift({label:"Hubungkan lagi", run: () => location.reload()});
                promptGame("Game Dijeda", message, actions);
            } else {
                toast(message);
                FCGameManager.visualStake = undefined;
                FCGameManager.setState(FCSTATE.READY);
                this.optCtrl.updateBtnState(true);
                this.optCtrl.canSendSpin = true;
            }
        } finally { this.inGameRequest = false; }
    }

    handleAnimationError(error: unknown) {
        console.error('[AG10] animation', error);
        if (this.replay) {
            toast("Gagal memutar rekaman. Silakan coba lagi.");
            this.replayControls?.done("Rekaman Gagal");
            return;
        }
        promptGame("Game Dijeda", "Gagal memulihkan tampilan game. Silakan hubungkan kembali.", [
            {label:"Hubungkan lagi", run: () => location.reload()}, {label:"Kembali ke lobi", run: exitGame},
        ]);
    }

    async continuePlay(frame: Frame, restoring = false) {
        if (restoring) this.centerRollCtrl.restoreSpecial(frame.freeRemaining);
        else if (frame.triggeredFree) {
            this.centerRollCtrl.playAvatarAnim('triSpecial');
            await this.centerRollCtrl.triFreeGameAnim(frame.gameData.specialTotal);
        }
        if (!this.isValid) return;
        this.optCtrl.updateSpecialCnt(Math.max(0, frame.freeRemaining - 1));
        this.centerRollCtrl.startSpecialRotation();
        void this.receive(true);
    }

    onPlayFinished() {
        FCGameManager.visualStake = undefined;
        if (!this.replay) {
            this.optCtrl.updateBitView();
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
        FCGameManager.restRound();
        FCGameManager.visualStake = replay.frames[0].betAmount;
        this.centerRollCtrl.showStoredBoard(boardToIcons(replay.startBoard?.length ? replay.startBoard : defaultBoard).icons);
        this.optCtrl.updateBitView();
        this.optCtrl.setAwardNum(0);
        this.optCtrl.setAllNum();
        this.optCtrl.canSendSpin = false;
        this.optCtrl.updateBtnState(false);
        this.scheduleOnce(() => {
            FCGameManager.setState(FCSTATE.RUNNING);
            this.centerRollCtrl.startRotation();
            void this.receive(false);
        }, 0.5);
    }

    private notifyReplayParent(kind: 'playing' | 'exit') {
        window.parent.postMessage({type: 'ag10-replay-' + kind, channel: this.nativeReplay}, location.origin);
    }

    showHistory() {
        if (this.replay || FCGameManager.getState() !== FCSTATE.READY || !this.optCtrl.canSendSpin ||
            FCGameManager.getAudoNum() > 0) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.historyPage ??= new FCBetHistory(canvas, goSession.entry.policy.currency)).open();
    }

    onDestroy() {
        this.historyPage?.destroy();
        this.replayControls?.destroy();
        closeGameDialogs();
        super.onDestroy();
    }

    onBtnShop() { toast("Silakan kembali ke lobi untuk deposit."); }
    onBtnExit() {
        if (FCGameManager.getState() === FCSTATE.READY || this.replay) exitGame();
        else toast("Game belum selesai. Mohon tunggu.");
    }
}
