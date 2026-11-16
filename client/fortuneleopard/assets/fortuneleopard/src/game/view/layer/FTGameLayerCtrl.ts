import { FTBetHistory } from '../../history/FTBetHistory';
import { shareFromParent } from '../../history/native_replay_bridge';
import { closeGameDialogs } from '../../ui/game_dialogs';
import { _decorator, Node, Vec3, tween, Tween, TweenAction, TweenSystem, Label, Color, UITransform, sys, find } from 'cc';
import { ftframe } from '../../../ftframe/ftframe';

import { xNodeFT } from '../../../xtools/xNodeFT';
import { FTBaseNode } from '../../base/FTBaseNode';
import { longToNumber } from '../../common/FTUtils';
import { FTConstant, FTSTATE } from '../../FTConstant/FTConstant';
import FTLoadManager from '../../load/FTLoadManager';
import { FTGameManager } from '../../mgr/FTGameManager';
import FTCenterRollCtrl from '../layer/FTCenterRollCtrl';
import { FTAniLayerCtrl } from './FTAniLayerCtrl';
import { FTAudioMgr } from './FTAudioMgr';
import { FTConfigCtrl } from './FTConfigCtrl';
import { FTGlobal } from './FTGlobal';
import { FTLanguage } from './FTLanguage';
// import { FTNumRollCtrl } from './FTNumRollCtrl';
import { FTOptCtrl } from './FTOptCtrl';
import { FTEventName } from '../../../ftframe/event/FTEventName';
import { goSession } from '../../net/FTGoSession';
import { ReplayControls } from '../../history/replay_controls';
import { replayShareURL } from '../../history/replay_share';
import { originalBoard, toOriginalAward, type OriginalAward } from '../../net/FTResultAdapter';
// import FTPopupCtrl from './FTPopupCtrl';
const { ccclass, property } = _decorator;

@ccclass('FTGameLayerCtrl')
export class FTGameLayerCtrl extends FTBaseNode {

    centerRollCtrl: FTCenterRollCtrl = null;
    aniLayerCtrl: FTAniLayerCtrl = null;
    optCtrl: FTOptCtrl = null;

    // lineNode: Node = null;
    firstEnter: boolean = true;
    startTime: number = 0;
    sysAutoNum: number = 0;
    onLoad() {
        FTLoadManager.ins.showLoading();
        FTAudioMgr.Instance.playMusic();
        let date = new Date()
        this.startTime = date.getTime()
    }

    protected initAttribute() {
        this.centerRollCtrl = xNodeFT.findComponent("layout_center", this.node, FTCenterRollCtrl);
        this.aniLayerCtrl = xNodeFT.findComponent('node_ani', this.node, FTAniLayerCtrl);
        this.optCtrl = xNodeFT.findComponent('layout_bottom', this.node, FTOptCtrl);
    }

    onDestroy() {
        closeGameDialogs();
        this.betHistory?.destroy();
        this.replayControls?.destroy();
        super.onDestroy();
    }

    start() {
        this.initAttribute();

        FTLoadManager.ins.hideLoading();
        this.optCtrl.setStartBit();
        this.optCtrl.setAllNum();
        this.optCtrl.updateBitView();
        this.scheduleOnce(() => void this.restoreGoEntry());
    }
    private replayControls?: ReplayControls;
    private betHistory?: FTBetHistory;
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
        this.optCtrl.setAwardNum(0);
        this.optCtrl.updateBtnState(false);
        this.centerRollCtrl.startRotation();
        FTGameManager.setState(FTSTATE.RUNING);
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
                    FTGameManager.setBitIndex(restored.index);
                    FTGameManager.setBitMultIndex(restored.level - 1);
                    this.optCtrl.updateBitView(FTGameManager.getTotalBitIndexBy(restored.index, restored.level - 1));
                    FTGameManager.setState(FTSTATE.RUNING);
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
        } catch (error) {
            this.goFailure(error);
        }
    }

    async requestGoAward(index: number, levelIndex: number) {
        this.centerRollCtrl._canStop = false;
        try {
            const { award, balance } = await goSession.begin(FTGameManager.getBitNum(index), FTGameManager.getMultIndexs()[levelIndex]);
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
        this.optCtrl.canSendSpin = false;
        this.centerRollCtrl._canStop = false;
        this.centerRollCtrl.stopForConnectionError();
        FTLoadManager.ins.showAlertWithInit(error.message, () => location.reload());
    }

    private presentAward(data: OriginalAward, balance?: number, resume?: {symbols: number[]}) {
        if (balance !== undefined) FTGlobal.USER.gold = balance;

        this.optCtrl.setAllNum();
        this.applyAward(data);
        if (resume) this.centerRollCtrl.resumeRespin(resume.symbols);
        else this.centerRollCtrl.setCanStop();
    }

    private applyAward(data: OriginalAward) {
        FTGameManager.setRotateData(data.mRotateData);
        FTGameManager.setWinAllMoney(longToNumber(data.win_money_all));
        FTGameManager.setWinAllMoneyR(longToNumber(data.win_money_all));
        FTGameManager.setMoney(longToNumber(data.mMoney));
    }

    // onClickBtnDetail() {
    //     FTAudioMgr.Instance.playSound("button/InfoButton")
    //     xNodeFT.hide("bg_set", this.node)
    //     FTLoadManager.ins.showPrefabWithLoading("res/load/prefab/layer/RuleLayer", xNodeFT.find("window", this.node))
    // }

    // onClickSetExpand(e) {
    //     FTAudioMgr.Instance.playSound("button/OtherButton");
    //     let bg_set: Node = xNodeFT.find("bg_set", this.node);
    //     bg_set.active = !bg_set.active
    // }

    // onClickBtnSet(event) {
    //     FTAudioMgr.Instance.playSound("button/OtherButton");
    //     xNodeFT.hide("bg_set", this.node);
    //     FTLoadManager.ins.showPrefabWithLoading("res/load/prefab/layer/SettingPlatform", xNodeFT.find("window", this.node))
    // }

    onBtnExit() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        if (FTGameManager.getState() == FTSTATE.READY) {
            this.exitToLobby()
        } else {
            let content = FTConfigCtrl.Instance.getLanguageText(FTLanguage.GAME_IS_NOT_END)
            FTLoadManager.ins.showAlertWithInit(content, () => { }, () => { },)
            return
        }
    }

    onBtnMenu() {
        if (this.isReplay || FTGameManager.getState() !== FTSTATE.READY) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        if (!canvas) return;
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        this.betHistory ??= new FTBetHistory(canvas, FTGlobal.coinSymbol);
        this.betHistory.open();
    }

}
