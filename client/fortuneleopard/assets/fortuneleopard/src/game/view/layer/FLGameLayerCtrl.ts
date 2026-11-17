import { FLBetHistory } from '../../history/FLBetHistory';
import { shareFromParent } from '../../history/native_replay_bridge';
import { closeGameDialogs } from '../../ui/game_dialogs';
import { _decorator, Director, director, Node, Vec3, tween, Tween, TweenAction, TweenSystem, Label, Color, UITransform, sys, find } from 'cc';
import { flframe } from '../../../flframe/flframe';

import { xNodeFL } from '../../../xtools/xNodeFL';
import { FLBaseNode } from '../../base/FLBaseNode';
import { longToNumber } from '../../common/FLUtils';
import { FLConstant, FLSTATE } from '../../FLConstant/FLConstant';
import FLLoadManager from '../../load/FLLoadManager';
import { FLGameManager } from '../../mgr/FLGameManager';
import FLCenterRollCtrl from '../layer/FLCenterRollCtrl';
import { FLAniLayerCtrl } from './FLAniLayerCtrl';
import { FLAudioMgr } from './FLAudioMgr';
import { FLConfigCtrl } from './FLConfigCtrl';
import { FLGlobal } from './FLGlobal';
import { FLLanguage } from './FLLanguage';
// import { FLNumRollCtrl } from './FLNumRollCtrl';
import { FLOptCtrl } from './FLOptCtrl';
import { FLEventName } from '../../../flframe/event/FLEventName';
import { goSession } from '../../net/FLGoSession';
import { FLAudioManager } from '../../../flframe/audio/FLAudioManager';
import { ReplayControls } from '../../history/replay_controls';
import { replayShareURL } from '../../history/replay_share';
import { originalBoard, toOriginalAward, type OriginalAward } from '../../net/FLResultAdapter';
// import FLPopupCtrl from './FLPopupCtrl';
const { ccclass, property } = _decorator;

@ccclass('FLGameLayerCtrl')
export class FLGameLayerCtrl extends FLBaseNode {

    centerRollCtrl: FLCenterRollCtrl = null;
    aniLayerCtrl: FLAniLayerCtrl = null;
    optCtrl: FLOptCtrl = null;

    // lineNode: Node = null;
    firstEnter: boolean = true;
    startTime: number = 0;
    sysAutoNum: number = 0;
    onLoad() {
        // FLGameScene is the direct entry; initialize services here instead of the removed h5main bootstrap.
        flframe.audio = FLAudioManager.instance;
        FLLoadManager.ins.showLoading();
        FLAudioMgr.Instance.playMusic();
        let date = new Date()
        this.startTime = date.getTime()
    }

    protected initAttribute() {
        this.centerRollCtrl = xNodeFL.findComponent("layout_center", this.node, FLCenterRollCtrl);
        this.aniLayerCtrl = xNodeFL.findComponent('node_ani', this.node, FLAniLayerCtrl);
        this.optCtrl = xNodeFL.findComponent('layout_bottom', this.node, FLOptCtrl);
    }

    onDestroy() {
        closeGameDialogs();
        this.betHistory?.destroy();
        this.replayControls?.destroy();
        super.onDestroy();
    }

    async start() {
        this.initAttribute();
        try {
            if (!FLLoadManager.ins.init()) throw new Error("Game resources unavailable");
            await new Promise<void>((resolve, reject) => FLLoadManager.ins.preLoadDir(
                (_done, _total) => {}, err => err ? reject(err) : resolve()));
            // FLGame already establishes the REST/replay entry before the
            // child layer starts. Do not open a second session here: it can
            // replace the first state and makes the first Spin use stale/null
            // scene references. Keep this fallback for editor scenes that
            // instantiate the layer without FLGame.
            if (!goSession.entry) {
                const data = await goSession.connect();
                goSession.entry = { live: data };
                FLGlobal.USER.uid = data.uid;
                FLGlobal.USER.gold = data.state.balance;
                FLGlobal.coinSymbol = data.policy.currency;
                FLGameManager.setGoBetLevels(data.policy.betLevel);
                FLGameManager.setMultiples(data.policy.betOptions.map(Number));
                FLGameManager.setAllMultiples(data.policy.betOptions.map(bet => Number(bet) * FLConstant.ALL_LINE));
                FLGameManager.setTotalBitList();
            }
            FLLoadManager.ins.hideLoading();
            if (goSession.entry.live) {
                this.optCtrl.setStartBit();
                this.optCtrl.setAllNum();
                this.optCtrl.updateBitView();
            }
            this.scheduleOnce(() => void this.restoreGoEntry());
        } catch (error) {
            this.goFailure(error instanceof Error ? error : new Error(String(error)));
        }
    }
    private replayControls?: ReplayControls;
    private betHistory?: FLBetHistory;
    private nativeReplay = new URLSearchParams(location.search).get('nativeReplay');

    private exitToLobby() {
        if (this.nativeReplay && window.parent !== window) {
            window.parent.postMessage({type:'ag4-replay-exit', channel:this.nativeReplay}, location.origin);
        } else if (window.parent !== window) {
            window.parent.postMessage({type:'aislots:exit',gameId:'AG9'}, '*');
        } else if (this.isReplay && history.length > 1) {
            history.back();
        } else if (this.isReplay) {
            const url = new URL(location.href);
            url.searchParams.delete('replay');
            url.searchParams.delete('share');
            location.replace(url);
        }
    }

    private playReplay() {
        const replay = goSession.entry?.replay;
        if (!replay) return;
        this.centerRollCtrl.setIdleBoard(replay.startBoard ? originalBoard(replay.startBoard) : undefined);
        this.optCtrl.setAllNum();
        this.optCtrl.setAwardNum(0);
        this.optCtrl.updateBtnState(false);
        this.centerRollCtrl.startRotation();
        FLGameManager.setState(FLSTATE.RUNING);
        this.presentAward(replay.award);
        this.reportReplayStep(1);
    }

    reportReplayStep(step: number) {
        const replay = goSession.entry?.replay;
        if (replay) this.replayControls?.progress(Math.min(step, replay.count) - 1, replay.count, !!replay.award.mRotateData.mFreeList);
    }

    finishReplay() { this.replayControls?.done(); }

    get isReplay() { return goSession.replay; }

    private async restoreGoEntry() {
        try {
            const { live, replay } = goSession.entry || {};
            if (replay) {
                const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
                const shareToken = new URLSearchParams(location.search).get('share');
                if (canvas) this.replayControls = new ReplayControls(canvas, replay.betId, () => this.exitToLobby(), {
                    share: this.nativeReplay ? () => shareFromParent(this.nativeReplay) : async () =>
                        replayShareURL(location.href, replay.betId,
                            shareToken || (await goSession.shareReplay(replay.betId)).shareToken),
                }, () => this.playReplay());
                this.playReplay();
                if (this.nativeReplay) window.parent.postMessage(
                    {type:'ag4-replay-playing', channel:this.nativeReplay}, location.origin);
            } else if (live) {
                const frame = live.state.lastFrame;
                const symbols = frame && originalBoard(frame.board);
                this.centerRollCtrl.setIdleBoard(symbols);
                if (live.state.hasNext) {
                    this.optCtrl.updateBtnState(false);
                    this.optCtrl.canSendSpin = false;
                    const restored = goSession.restore(live.state, live.policy);
                    FLGameManager.setBitIndex(restored.index);
                    FLGameManager.setBitMultIndex(restored.level - 1);
                    this.optCtrl.updateBitView(FLGameManager.getTotalBitIndexBy(restored.index, restored.level - 1));
                    FLGameManager.setState(FLSTATE.RUNING);
                    this.presentAward(restored.award, restored.balance, { symbols });
                } else if (frame?.nextAction === 'complete') {
                    const { mRotateData, win_money_all } = toOriginalAward([frame]);
                    this.optCtrl.setAwardNum(longToNumber(win_money_all));
                    const lines = mRotateData.mAwardList;
                    if (lines?.length) {
                        this.centerRollCtrl.showSlotsGray(true);
                        this.centerRollCtrl.showWinTrace(lines, lines.length, mRotateData.bonusMultiplier);
                    }
                }
            }
            director.once(Director.EVENT_AFTER_DRAW, () => {
                if (this.isValid) window.dispatchEvent(new Event('aislots-scene-rendered'));
            });
        } catch (error) {
            this.goFailure(error);
        }
    }

    async requestGoAward(index: number, levelIndex: number) {
        this.centerRollCtrl._canStop = false;
        try {
            const { award, balance } = await goSession.begin(FLGameManager.getBitNum(index), FLGameManager.getMultIndexs()[levelIndex]);
            if (this.isValid) this.presentAward(award, balance);
        } catch (error) {
            if (this.isValid) this.goFailure(error);
        }
    }

    async requestNextRespin() {
        try {
            const award = await goSession.nextRespin();
            if (!this.isValid) return;
            this.applyAward(award);
            this.centerRollCtrl._canStop = true;
        } catch (error) {
            if (this.isValid) this.goFailure(error);
        }
    }

    goFailure(error: Error) {
        console.error("[AG9] game flow failed", error);
        this.optCtrl.canSendSpin = false;
        this.centerRollCtrl._canStop = false;
        this.centerRollCtrl.stopForConnectionError();
        // Technical failures belong in the console with their original stack, not a player alert.
    }

    private presentAward(data: OriginalAward, balance?: number, resume?: {symbols: number[]}) {
        if (balance !== undefined) FLGlobal.USER.gold = balance;

        this.optCtrl.setAllNum();
        this.applyAward(data);
        if (resume) this.centerRollCtrl.resumeRespin(resume.symbols);
        else this.centerRollCtrl.setCanStop();
    }

    private applyAward(data: OriginalAward) {
        FLGameManager.setRotateData(data.mRotateData);
        FLGameManager.setWinAllMoney(longToNumber(data.win_money_all));
        FLGameManager.setWinAllMoneyR(longToNumber(data.win_money_all));
        FLGameManager.setMoney(longToNumber(data.mMoney));
    }

    // onClickBtnDetail() {
    //     FLAudioMgr.Instance.playSound("button/InfoButton")
    //     xNodeFL.hide("bg_set", this.node)
    //     FLLoadManager.ins.showPrefabWithLoading("res/load/prefab/layer/RuleLayer", xNodeFL.find("window", this.node))
    // }

    // onClickSetExpand(e) {
    //     FLAudioMgr.Instance.playSound("button/OtherButton");
    //     let bg_set: Node = xNodeFL.find("bg_set", this.node);
    //     bg_set.active = !bg_set.active
    // }

    // onClickBtnSet(event) {
    //     FLAudioMgr.Instance.playSound("button/OtherButton");
    //     xNodeFL.hide("bg_set", this.node);
    //     FLLoadManager.ins.showPrefabWithLoading("res/load/prefab/layer/SettingPlatform", xNodeFL.find("window", this.node))
    // }

    onBtnExit() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        if (FLGameManager.getState() == FLSTATE.READY) {
            this.exitToLobby()
        } else {
            let content = FLConfigCtrl.Instance.getLanguageText(FLLanguage.GAME_IS_NOT_END)
            FLLoadManager.ins.showAlertWithInit(content, () => { }, () => { },)
            return
        }
    }

    onBtnMenu() {
        if (this.isReplay || FLGameManager.getState() !== FLSTATE.READY) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        if (!canvas) return;
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        this.betHistory ??= new FLBetHistory(canvas, FLGlobal.coinSymbol);
        this.betHistory.open();
    }

}
