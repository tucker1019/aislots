import { _decorator, Node, Vec3, tween, Tween, TweenAction, TweenSystem, Label, Color, UITransform, sys, find } from 'cc';
import { ftframe } from '../../../ftframe/ftframe';

import { xNodeFT } from '../../../xtools/xNodeFT';
import { requestOpenAwardS2C } from '../../3rd/game_1017';
import { FTPlatformMgr } from '../../3rd/FTPlatformMgr';
import { FTBaseNode } from '../../base/FTBaseNode';
import { FTBaseToggle } from '../../base/FTBaseToggle';
import { exitToLogin, exitToPlatform, longToNumber, showMoney } from '../../common/FTUtils';
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
import { FTPopupMenuCtrl } from './FTPopupMenuCtrl';
import { goSession } from '../../net/FTGoSession';
import { ReplayControls } from '../../history/replay_controls';
import { replayShareURL } from '../../history/replay_share';
import { originalBoard } from '../../net/FTResultAdapter';
import GameBridge from '../../../../../game.bridge';
// import FTPopupCtrl from './FTPopupCtrl';
const { ccclass, property } = _decorator;


@ccclass('FTGameLayerCtrl')
export class FTGameLayerCtrl extends FTBaseNode {

    centerRollCtrl: FTCenterRollCtrl = null;
    aniLayerCtrl: FTAniLayerCtrl = null;
    optCtrl: FTOptCtrl = null;
    popupMenuCtrl: FTPopupMenuCtrl = null;
    lab_all_money: Label = null;
    // myGoldCtrl: FTNumRollCtrl = null;
    // setBtnNode: Node = null;
    shopBtnNode: Node = null;
    // detailBtnNode: Node = null;
    // setExpandBtnNode: Node = null;
    realSwitch: Node = null;
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
        this.popupMenuCtrl = find("Canvas/TopLayer/node_popup_menu").getComponent(FTPopupMenuCtrl)
        // xNodeFT.findComponent('node_popup_menu', this.node, FTPopupMenuCtrl);
        this.lab_all_money = find("Canvas/SafeLayer/layout_top/node_count/lab_mygold").getComponent(Label)

        this.shopBtnNode = find("Canvas/SafeLayer/layout_top/node_count/btn_shop");

        this.realSwitch = find("Canvas/SafeLayer/layout_top/realSwitch")
        // this.setBtnNode = xNodeFT.find("bg_set/btn_set", this.node);
        console.log("this.realSwitch", this.realSwitch, this.shopBtnNode)
        // this.detailBtnNode = xNodeFT.find("bg_set/btn_detail", this.node);
        // xNodeFT.hide("bg_set", this.node);
        // this.shopBtnNode.active = FTPlatformMgr.getPayAbility();
        // xNodeFT.setActive("", this.realSwitch, FTGlobal.PLATFORM == "mobile")
        xNodeFT.hide("", this.realSwitch)

        // find("Canvas/SafeLayer/layout_top/btn_exit").active = false

        find("Canvas/SafeLayer/layout_top/node_count/icon_gold/coin").active = FTGlobal.coinType == 1
        find("Canvas/SafeLayer/layout_top/node_count/icon_gold/bonus").active = FTGlobal.coinType == 2

        find("Canvas/SafeLayer/layout_top/node_count/icon_gold/coin/Label").getComponent(Label).string = FTGlobal.coinSymbol
        find("Canvas/SafeLayer/layout_top/node_count/icon_gold/bonus/Label").getComponent(Label).string = FTGlobal.coinSymbol




    }

    private initBtnClick() {
        // xNodeFT.addClick("", this.setExpandBtnNode, this.onClickSetExpand.bind(this))
        // xNodeFT.addClick("", this.setBtnNode, this.onClickBtnSet.bind(this));
        // xNodeFT.addClick("", this.detailBtnNode, this.onClickBtnDetail.bind(this));
        xNodeFT.addClick("", find("Canvas/SafeLayer/layout_top/btn_exit"), this.onBtnExit.bind(this));
        xNodeFT.addClick("", this.shopBtnNode, this.onBtnShop.bind(this))
        xNodeFT.addClick("", this.realSwitch, this.onRealSwitch.bind(this))
        xNodeFT.addClick("", find("Canvas/SafeLayer/layout_top/btn_menu"), this.onBtnMenu.bind(this));
    }

    onDestroy() {
        this.replayControls?.destroy();
        super.onDestroy();
    }

    start() {
        GameBridge.callNoReturnValue('ENTER_GAME');
        this.initAttribute();
        this.initBtnClick();
        this.updateRealSwitchView();
        FTLoadManager.ins.hideLoading();
        this.optCtrl.setStartBit();
        this.optCtrl.updateBitView();
        this.scheduleOnce(() => void this.restoreGoEntry());
        // this.showEnterSceneAni();
    }
    /**
     * 进入场景动画
     */
    showEnterSceneAni() {
        this.scheduleOnce(() => {
            let height = this.optCtrl.node.getComponent(UITransform).contentSize.height;
            let posOptCtrl: Vec3 = this.optCtrl.node.getPosition();
            posOptCtrl.y -= height;
            this.optCtrl.node.setPosition(posOptCtrl);
            tween(this.optCtrl.node).by(0.5, { position: new Vec3(0, height, 0) }).start()
            let topNode = find("Cavnas/layout_top")
            let heightTop = topNode.getComponent(UITransform).contentSize.height
            let posTopNode: Vec3 = topNode.getPosition();
            posTopNode.y += heightTop;
            topNode.setPosition(posTopNode);
            tween(topNode).by(0.5, { position: new Vec3(0, -heightTop, 0) }).start()
        })
    }
    /**
     * 更新 realSwitch显示
     */
    updateRealSwitchView() {
        let isCheck = FTGlobal.MODE == "real";
        this.realSwitch.getComponent(FTBaseToggle).setChecked(isCheck);
        xNodeFT.setProperty("RealLab", this.realSwitch, Label, "color", isCheck ? new Color(255, 255, 255, 255) : new Color(255, 255, 255, 150));
        xNodeFT.setProperty("FunLab", this.realSwitch, Label, "color", isCheck ? new Color(255, 255, 255, 150) : new Color(255, 255, 255, 255));
        FTGlobal.USER.experienceGold = 10000000;
        this.optCtrl.setAllNum();
        this.setAllNum();
    }

    setRealSwitchInteractable(isshow) {
        xNodeFT.setBtnInteractable("", this.realSwitch, isshow)
    }

    private replayControls?: ReplayControls;

    private exitToLobby() {
        if (window.parent !== window) {
            window.parent.postMessage({type:'aislots:exit',gameId:'AG4'}, '*');
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
        this.onMessageOpenAward(10174, replay.award);
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
                    share: async () => replayShareURL(location.href, replay.betId,
                        shareToken || (await goSession.shareReplay(replay.betId)).shareToken),
                }, () => this.playReplay());
                this.playReplay();
            } else if (live) {
                const frame = live.state.lastFrame;
                const symbols = frame && originalBoard(frame.board);
                this.centerRollCtrl.setIdleBoard(symbols);
                if (live.state.hasNext) {
                    this.optCtrl.updateBtnState(false);
                    this.optCtrl.canSendSpin = false;
                    const restored = await goSession.restore(live.state, live.policy);
                    FTGameManager.setBitIndex(restored.index);
                    FTGameManager.setBitMultIndex(restored.level - 1);
                    this.optCtrl.updateBitView(FTGameManager.getTotalBitIndexBy(restored.index, restored.level - 1));
                    FTGameManager.setState(FTSTATE.RUNING);
                    this.onMessageOpenAward(10174, restored.award, restored.balance, { step: frame.stepIndex, symbols });
                }
            }
        } catch (error) {
            this.goFailure(error);
        }
    }

    async requestGoAward(index: number, levelIndex: number) {
        this.centerRollCtrl._canStop = false;
        try {
            const { award, balance } = await goSession.begin(FTGameManager.getBitNum(index), FTGameManager.getMultIndexs()[levelIndex], index);
            if (this.isValid) this.onMessageOpenAward(10174, award, balance);
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

    onMessageOpenAward(cmd, data: requestOpenAwardS2C, balance?: number, resume?: {step: number; symbols: number[]}) {

        ftframe.log.logModel(data, "onMessageOpenAward")
        let mResult: number = data.mResult;
        if (mResult == 1) {
            FTPlatformMgr.pay(1)
            return
        }
        if (data.mResult == 5) {
            let logout: string = FTConfigCtrl.Instance.getLanguageText(FTLanguage.LOGOUT)
            FTLoadManager.ins.showAlertWithInit(logout, () => {
                exitToLogin()
            })
        }
        if (data.mResult != 0) return;

        if (balance !== undefined) FTGlobal.USER.gold = balance;

        this.optCtrl.setAllNum();
        this.setAllNum();
        // FTGameManager.setFreeGameRotates(data.mFreeGameRotates);//免费游戏数据
        // FTGameManager.setBonusGameRotates(data.mBoxRotates);//免费游戏数据
        FTGameManager.setRotateData(data.mRotateData);
        // FTGameManager.setBonusMaxCnt(data.mBoxCount);
        FTGameManager.setWinAllMoney(longToNumber(data.win_money_all));
        FTGameManager.setWinAllMoneyR(longToNumber(data.win_money_all));
        FTGameManager.setMoney(longToNumber(data.mMoney));
        FTGameManager.setEveryType();

        if (resume) this.centerRollCtrl.resumeRespin(resume.step, resume.symbols);
        else this.centerRollCtrl.setCanStop();
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

    // 刷新总钱
    setAllNum(nums: number = null) {
        Tween.stopAllByTarget(this.lab_all_money.node);
        let num = nums;
        if (!nums) {
            num = FTGlobal.USER.gold

        }
        FTPlatformMgr.refreshCoin(num)
        this.lab_all_money.string = showMoney(num)
    }


    onBtnShop() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press")
        FTPlatformMgr.pay()
    }

    onRealSwitch() {
        if (FTGameManager.getState() === FTSTATE.READY) {
            let isCheck = this.realSwitch.getComponent(FTBaseToggle).getChecked();
            isCheck = !isCheck;
            FTGlobal.MODE = isCheck ? "real" : "fun";
            this.updateRealSwitchView();
            this.optCtrl.setStartBit();
        }
    }

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
        if (this.isReplay) return;
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        if (FTGameManager.getState() == FTSTATE.READY) {
            FTLoadManager.ins.showPrefabWithLoading("res/load/prefab/games/panel_menu", find("Canvas/SafeLayer"))

        }
    }

}

