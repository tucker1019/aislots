import { _decorator, Component, find, Node, tween, Tween, isValid, UIOpacity, Animation, Button, UITransform, Vec3, Label, instantiate } from "cc";
import { xNodeWBS } from "../../xtools/xNodeWBS";
import { WBSConstant, WBSSTATE } from "../constant/WBSConstant";
import { WBSGameLayer } from "./WBSGameLayer";
import { WBSRollLayer } from "./WBSRollLayer";
import { RollNumLabel } from "../component/RollNumLabel";
import { showMoney } from "../../xtools/WBSUtils";
import { wbsgame } from "../wbsgame";
import { WBSSpriteCtrl } from "./WBSSpriteCtrl";
import { WBSButtonTrans } from "./WBSButtonTrans";
import { WBSEventName } from "../constant/WBSEventName";
import { WBSConfig } from "../cfg/WBSConfig";

const { ccclass, property } = _decorator;

@ccclass('WBSOptLayer')
export class WBSOptLayer extends Component {

    @property(Node)
    quickStopBtn: Node = null;

    lab_all_money: Label = null;    // 玩家总钱
    lab_bit_bottom: Label = null;   // 当前押注
    lab_award_num: Label = null;    // 当前赢钱
    lab_bit_bottom_scale: Vec3 = null;

    btn_all: Node = null;    // 总钱点击
    btn_bet: Node = null;    // 押注点击


    private panelRestY = 0;
    panel1: Node = null;    // 第一页panel--包含spin等按钮
    panel2: Node = null;    // 第二页panel--包含rule等按钮
    btn_menu: Node = null;      // 菜单



    btn_exit: Node = null;      // 退出按钮
    btn_sound: Node = null;     // 音量
    btn_rule: Node = null;      // 规则 
    btn_close: Node = null;     // 关闭panel2


    private goBtnNode: Node = null;
    private stopBtnNode: Node = null;
    private autoBtnNode: Node = null;
    private stopAutoBtnNode: Node = null;
    private btn_turbo: Node = null;     // 快速按钮
    private subBtnNode: Node = null;    // 减注
    private addBtnNode: Node = null;    // 加注
    private ib_bar: Node = null;
    private node_win_big: Node = null;
    private gameCtrl: WBSGameLayer = null;
    private rollCtrl: WBSRollLayer = null;
    // public winMoneyRoll: RollNumLabel = null;
    private isBetCanlick: boolean = true;

    // private isHoldAuto: boolean = false;

    start() {

        // WBSUtils.translateAll(this.node)
        this.initAttribute();
        this.initBtnClick();
        this.initTurboBtn();
        this.showNorTitle(true, "init");
        // this.showBottomTips(1)
        // this.showFree(false)
        // this.updateBottomTop(false, true)
        // this.showWinLineTips(false)

    }

    initAttribute() {


        this.panel1 = xNodeWBS.find("panel1", this.node);
        this.panel2 = xNodeWBS.find("panel2", this.node);
        this.panelRestY = this.panel1.position.y;
        this.btn_menu = xNodeWBS.find("panel1/btn_menu", this.node);
        this.btn_exit = xNodeWBS.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeWBS.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeWBS.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeWBS.find("panel2/btn_close", this.node);


        this.gameCtrl = find("Canvas/gamelayer").getComponent(WBSGameLayer)
        this.rollCtrl = find("Canvas/gamelayer/roll").getComponent(WBSRollLayer)
        this.lab_all_money = xNodeWBS.findComponent("panel_parm/node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeWBS.findComponent("panel_parm/node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeWBS.findComponent("panel_parm/node_win/lab", this.node, Label);
        this.lab_bit_bottom_scale = this.lab_bit_bottom.node.getScale();
        this.btn_all = xNodeWBS.find("panel_parm/node_all", this.node);
        this.btn_bet = xNodeWBS.find("panel_parm/node_bet", this.node);
        this.goBtnNode = xNodeWBS.find("panel1/btn_go", this.node);
        this.stopBtnNode = xNodeWBS.find("panel1/btn_stop", this.node);
        this.autoBtnNode = xNodeWBS.find("panel1/btn_auto", this.node);
        this.stopAutoBtnNode = xNodeWBS.find("panel1/btn_autostop", this.node);
        this.btn_turbo = xNodeWBS.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeWBS.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeWBS.find("panel1/btn_add", this.node);
        this.ib_bar = xNodeWBS.find("ib_bar", this.node);
        this.node_win_big = xNodeWBS.find("node_win_big", this.node);

    }

    initBtnClick() {
        xNodeWBS.addClick("", this.btn_all, this.onALLMoneyClick.bind(this));
        xNodeWBS.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeWBS.addClick("", this.stopBtnNode, this.onClickStopBtn.bind(this));
        xNodeWBS.addClick("", this.autoBtnNode, this.showSetAuto.bind(this));
        xNodeWBS.addClick("", this.stopAutoBtnNode, this.onStopAudoRollClick.bind(this));
        xNodeWBS.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeWBS.addClick("", this.btn_menu, this.onClickMenuBtn.bind(this));

        xNodeWBS.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeWBS.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeWBS.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        xNodeWBS.addClick("panel2/btn_histroy", this.node, () => this.gameCtrl.onClickMenuBtn());
        xNodeWBS.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));

        xNodeWBS.addTouchStartClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeWBS.addTouchStartClick("", this.subBtnNode, this.onSubBtnClick.bind(this));



    }

    onCloseBtnClick() {
        wbsgame.audioMgr.playSound("menu_icon_press");
        this.changePanel(1);
    }
    onRuleBtnClick() {
        wbsgame.audioMgr.playSound("menu_icon_press")
        wbsgame.gamelayer.popupMenuCtrl.showRulePanel();
    }
    onBtnExit() {
        wbsgame.audioMgr.playSound("menu_icon_press")
        if (wbsgame.gameMgr.getState() == WBSSTATE.READY && this.gameCtrl.isGameEnd) {
            wbsgame.sendMgr.sendRequestExitRoom();
        } else {
            void wbsgame.loadMgr.showAlert('游戏尚未结束', undefined, '请等待本局结束后再退出。');
        }
    }
    onSoundBtnClick() {
        wbsgame.audioMgr.playSound("menu_icon_press")

        let ic_soundon = xNodeWBS.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeWBS.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        wbsgame.gameMgr.setUserData({ soundSwitch: ic_soundon.active });
        wbsgame.gameMgr.setUserData({ musicSwitch: ic_soundon.active });
        if (!wbsgame.gameMgr.getUserData().soundSwitch) {
            wbsgame.audioMgr.stopAllSound()
        }

    }
    updateBtnState(isshow: boolean) {
        xNodeWBS.setActive("", this.goBtnNode, isshow)
        xNodeWBS.setActive("", this.stopBtnNode, !isshow)
        if (!isshow) {
            xNodeWBS.setBtnInteractable("", this.stopBtnNode, true);
        }

        xNodeWBS.setBtnInteractable("", this.autoBtnNode, isshow, false, true)
        // xNodeWBS.setBtnInteractable("", this.btn_turbo, isshow)
        xNodeWBS.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeWBS.setBtnInteractable("", this.addBtnNode, isshow)
        this.showAddSubBtnState(this.subBtnNode);
        this.showAddSubBtnState(this.addBtnNode);
        xNodeWBS.setBtnInteractable("", this.btn_bet, isshow)
        xNodeWBS.setBtnInteractable("", this.btn_all, isshow)

        // xNodeWBS.setBtnInteractable("btn_set", this.node, isshow)
        // xNodeWBS.setActive("btn_quick", this.node, !isshow)
        // this.updateLeftBtnState(isshow)

        // xNodeWBS.setActive("", this.quickStopBtn, !isshow);

    }

    setAddSubBtnLimit(node: Node, bLimit: boolean) {
        let trans: WBSButtonTrans[] = node.getComponentsInChildren(WBSButtonTrans)
        trans && trans.forEach((item) => {
            if (isValid(item)) {
                item.setLocked(bLimit);
            }
        })
    }

    showAddSubBtnState(node: Node) {
        let trans: WBSButtonTrans[] = node.getComponentsInChildren(WBSButtonTrans)
        trans && trans.forEach((item) => {
            if (isValid(item)) {
                item.updateSpriteColor();
            }
        })
    }

    updateBitView(bitIndex: number = wbsgame.gameMgr.getBitIndex(), bClick = false) {
        let mMultiples: number[] = wbsgame.gameMgr.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = bitIndex >= max;
        let minBool = bitIndex <= min;
        bitIndex = Math.min(bitIndex, max);
        bitIndex = Math.max(bitIndex, min);
        // xNodeWBS.setBtnInteractable("", this.addBtnNode, !maxBool);
        // xNodeWBS.setBtnInteractable("", this.subBtnNode, !minBool);
        this.setAddSubBtnLimit(this.addBtnNode, maxBool);
        this.setAddSubBtnLimit(this.subBtnNode, minBool);
        wbsgame.gameMgr.setTotalBitIndex(bitIndex);
        this.lab_bit_bottom.string = showMoney(wbsgame.gameMgr.getTotalBitNum());
        Tween.stopAllByTarget(this.lab_bit_bottom.node);

        if (bClick) {
            if (bitIndex == min) {
                this.showTipPanel("min_bet");
            } else if (bitIndex == max) {
                this.showTipPanel("max_bet");
            }
            Tween.stopAllByTarget(this.lab_bit_bottom.node)
            this.lab_bit_bottom.node.scale = this.lab_bit_bottom_scale
            tween(this.lab_bit_bottom.node)
                .to(0.08, { scale: new Vec3(this.lab_bit_bottom_scale.x * 2, this.lab_bit_bottom_scale.y * 2) })
                .to(0.08, { scale: new Vec3(this.lab_bit_bottom_scale.x, this.lab_bit_bottom_scale.y) })
                .to(0.06, { scale: new Vec3(this.lab_bit_bottom_scale.x * 1.2, this.lab_bit_bottom_scale.y * 1.2) })
                .to(0.06, { scale: new Vec3(this.lab_bit_bottom_scale.x, this.lab_bit_bottom_scale.y) })
                .start()

        }
    }
    startAudo() {
        console.log(wbsgame.gameMgr.getState(), wbsgame.gameMgr.getIsAuto())
        if (wbsgame.gameMgr.getState() != WBSSTATE.READY) {
            return
        }
        xNodeWBS.setBtnInteractable("", this.autoBtnNode, false)
        xNodeWBS.show("", this.stopAutoBtnNode);
        xNodeWBS.setLabel("Label", this.stopAutoBtnNode, "" + (wbsgame.gameMgr.getAudoNum()))
        this.onClickGoBtn();
        // this.playTips("Auto Spin Enabled");
    }

    setStartBit() { this.updateBitView(wbsgame.gameMgr.getTotalBitIndex()); }

    onAddBtnClick() {
        if (wbsgame.sendMgr.readOnly) return;
        if (!this.addBtnNode.getComponent(Button).interactable) {
            return
        }
        // FTAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(wbsgame.gameMgr.getTotalBitIndex() + 1, true);
    }

    onSubBtnClick() {
        if (wbsgame.sendMgr.readOnly) return;
        if (!this.subBtnNode.getComponent(Button).interactable) {
            return
        }
        // FTAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(wbsgame.gameMgr.getTotalBitIndex() - 1, true);
    }


    onClickGoBtn(click: boolean = false, isBuyFree?) {
        if (wbsgame.sendMgr.readOnly) return;
        console.log("onClickGoBtn===>>>>>>>")

        if (click)
            wbsgame.audioMgr.playSound("spinBtn")
        if (!this.gameCtrl.isGameEnd) return
        if (wbsgame.gameMgr.getState() == WBSSTATE.RUNING || wbsgame.gameMgr.getState() == WBSSTATE.FREEING) return

        if (wbsgame.gameMgr.canPlay()) {
            if(wbsgame.gameMgr.getAudoNum()>0){
                wbsgame.gameMgr.consumeAutoSpin();
                xNodeWBS.setLabel("Label",this.stopAutoBtnNode,String(wbsgame.gameMgr.getAudoNum()));
            }
            wbsgame.gameMgr.reset();
            this.gameCtrl.isGameEnd = false
            this.setAwardNum(0)
            this.updateBtnState(false);
            void wbsgame.sendMgr.sendGo();
            wbsgame.gameMgr.setUserData({ localBetLevelIndex: wbsgame.gameMgr.getBitIndex() })
            wbsgame.gameMgr.setUserData({ localBetMultIndex: wbsgame.gameMgr.getBitMultIndex() })

            wbsgame.gameMgr.setState(WBSSTATE.RUNING);

            this.rollCtrl.startRoll();
            if (click) {
                this.playStopShow();
            }
        } else {
            void wbsgame.loadMgr.showAlert('余额不足', undefined, '请充值后再试。');
            wbsgame.gameMgr.setAudoNum(0);
            this.updateBtnState(true)
        }
    }

    onAutoSelectClick(custom) {
        if (wbsgame.sendMgr.readOnly) return;
        if (custom && this.goBtnNode.active) {
            wbsgame.gameMgr.setAudoNum(Number(custom))
            this.startAudo();
        }
    }

    onClickStopBtn() {
        if (wbsgame.gameMgr.getStop()) return
        wbsgame.gameMgr.setStop(true);
        xNodeWBS.setBtnInteractable("", this.stopBtnNode, false);

        this.gameCtrl.centerRollCtrl.onClickStop();
        xNodeWBS.find("sb_arrow_blur", this.stopBtnNode).active = false;
        xNodeWBS.find("sb_arrow_grey", this.stopBtnNode).active = true;
    }

    playStopShow() {
        this.stopBtnNode.getComponent(Animation).play();
        xNodeWBS.find("sb_arrow_blur", this.stopBtnNode).active = true;
        xNodeWBS.find("sb_arrow_grey", this.stopBtnNode).active = false;
    }

    async roundEnd(showAllWin: boolean = true) {

        wbsgame.gameMgr.setAutoAllWin(wbsgame.gameMgr.getAutoAllWin()+(wbsgame.gameMgr.frame?.totalWinAmount || 0));
        this.gameCtrl.isGameEnd = true

        this.gameCtrl.myGoldBottom.setString(wbsgame.gameMgr.getUserData().coin);
        wbsgame.platformMgr.refreshCoin()

        // if (wbsgame.gameMgr.getWinAllMoney() <= 0) {
        //     this.showBottomTips(1)
        // }

        let stop = false

        if (wbsgame.gameMgr.getAudoNum() > 0 && wbsgame.gameMgr.getAutoContinue() && !stop) {
            xNodeWBS.setLabel("Label", this.stopAutoBtnNode, (wbsgame.gameMgr.getAudoNum()) + '')
            this.onClickGoBtn()
            // this.scheduleOnce(() => { this.checkAuto(), time })
            return
        }

        this.scheduleOnce(() => {
            this.gameCtrl.sysAutoNum = wbsgame.gameMgr.getAudoNum() - 1;
            wbsgame.gameMgr.setState(WBSSTATE.READY);
            this.updateBtnState(true);
            xNodeWBS.show("", this.autoBtnNode);
            xNodeWBS.hide("", this.stopAutoBtnNode);
        }, 0)


    }

    rePlay() {
        if (wbsgame.gameMgr.getAudoNum() > 0 && wbsgame.gameMgr.getAutoContinue() && wbsgame.gameMgr.getState() == WBSSTATE.READY) {
            xNodeWBS.setLabel("Label", this.stopAutoBtnNode, (wbsgame.gameMgr.getAudoNum() + ""))
            this.onClickGoBtn()
        }
    }


    initTurboBtn() {
        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");
        node_off.active = true;
        node_on.active = false;
        wbsgame.gameMgr.setFast(false);
    }

    onTurboClick() {
        wbsgame.audioMgr.playSound("menu_icon_press")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")
        wbsgame.gameMgr.setFast(node_on.active)
    }

    onClickStopAutoBtn() {
        if (wbsgame.gameMgr.getIsAuto()) {
            wbsgame.gameMgr.setAudoNum(0);
            wbsgame.gameMgr.restAutoCfg()
            // xNodeSL.hide("", this.stopBtnNode)
            // this.isHoldAuto = false;

            xNodeWBS.show("", this.autoBtnNode);
            xNodeWBS.hide("", this.stopAutoBtnNode);
            // this.playTips("Auto Spin Disabled")
        } else {

        }
    }

    showSetAuto() {
        if (this.goBtnNode.active) {

            wbsgame.gamelayer.popupMenuCtrl.showAudoPanel();
        }
    }

    onStopAudoRollClick() {
        wbsgame.gameMgr.setAudoNum(0);
        xNodeWBS.hide("", this.stopAutoBtnNode)
        xNodeWBS.setActive("", this.stopBtnNode, wbsgame.gameMgr.getState() != WBSSTATE.READY)
        xNodeWBS.setActive("", this.goBtnNode, wbsgame.gameMgr.getState() == WBSSTATE.READY)
        // xNodeWBS.setActive("", this.btn_auto, FTGameManager.getState() == FTSTATE.READY)
    }

    showFreeBg(isFree) {
        let panel_parm = xNodeWBS.find("panel_parm", this.node);
        panel_parm.position = new Vec3(0, isFree ? -110 : 110, 0);
        xNodeWBS.setActive("panel1", this.node, !isFree);
        xNodeWBS.setActive("panel_free", this.node, isFree);
    }

    showFreeCnt(restCnt?: number, bAdd?: boolean) {
        let panel_free = xNodeWBS.find("panel_free", this.node);
        xNodeWBS.setActive("lfs", panel_free, restCnt <= 0);
        xNodeWBS.setActive("rfs", panel_free, restCnt > 0);

        let fnt_bw = xNodeWBS.find("rfs/fnt_bw", panel_free);
        fnt_bw.position = new Vec3(295, 0)
        if (bAdd) {
            let curCnt = Number(fnt_bw.getComponent(Label).string);
            let fsw_num_vfx_b_screen = xNodeWBS.find("fsw_num_vfx_b_screen", panel_free);
            fsw_num_vfx_b_screen.active = true;
            let oneTime = 3 / (restCnt - curCnt)
            for (let i = curCnt; i < restCnt; i++) {
                let newCnt = i + 1;
                this.scheduleOnce(() => {
                    wbsgame.audioMgr.playSound("fsWonRemainingIncrease");
                    tween(fnt_bw).to(oneTime / 2, { position: new Vec3(295, 20, 0) }).to(oneTime / 2, { position: new Vec3(295, 0, 0) }).start()

                    xNodeWBS.setLabel("", fnt_bw, "" + newCnt);
                    let animNode = instantiate(wbsgame.gamelayer.addFreeCntAnimPrefab);
                    animNode.parent = fsw_num_vfx_b_screen;
                    animNode.getComponent(Animation).play();
                    animNode.getComponent(Animation).on(Animation.EventType.FINISHED, () => {
                        animNode.destroy();
                    })
                    if (newCnt == restCnt) {
                        fsw_num_vfx_b_screen.active = false;
                    }
                }, i * oneTime)
            }

        } else {
            xNodeWBS.setLabel("", fnt_bw, "" + restCnt);
        }
    }

    showNorTitle(bShow, state?) {
        if (bShow) {
            this.ib_bar.active = true;
            let info_main = xNodeWBS.find("mask/info_main", this.ib_bar);

            let playInfoMainAnim = () => {
                Tween.stopAllByTarget(info_main);
                let maskW = xNodeWBS.find("mask", this.ib_bar).getComponent(UITransform).contentSize.width;
                let infoW = info_main.getComponent(UITransform).contentSize.width;
                if (infoW > maskW) {
                    info_main.position = new Vec3((infoW - maskW) / 2 + 30, info_main.position.y);
                    tween(info_main)
                        .delay(0.9)
                        .to(4, { position: new Vec3(-(maskW + infoW) / 2 - 5, info_main.position.y, 0) })
                        .start()
                } else {
                    info_main.position = new Vec3(0, info_main.position.y, 0);
                }
            }

            if (state == "free") {
                Tween.stopAllByTarget(this.ib_bar);
                info_main.getComponent(WBSSpriteCtrl).sprIndex = 4;
                playInfoMainAnim();
            } else {
                if (state == "init" || this.node_win_big.active) {
                    let list = [0, 1, 2, 3];
                    let showIdx = Math.floor(Math.random() * list.length);
                    Tween.stopAllByTarget(this.ib_bar);
                    tween(this.ib_bar)
                        .repeatForever(
                            tween().call(() => {
                                Tween.stopAllByTarget(info_main);
                                info_main.getComponent(WBSSpriteCtrl).sprIndex = showIdx;
                                showIdx = showIdx + 1;
                                if (showIdx == list.length) {
                                    showIdx = 0;
                                }
                                playInfoMainAnim();
                            }).delay(5)
                        )
                        .start()
                    info_main.getComponent(WBSSpriteCtrl).sprIndex = showIdx;
                }
            }

            this.node_win_big.active = false;
        } else {
            // this.ib_bar.active = false;
        }
    }

    setAwardNum(award: number) {
        if (award == 0) {
            this.lab_award_num.string = "0";
            return
        }
        this.lab_award_num.string = showMoney(award, false);
    }

    setBigAwardNum(award, type = 0, rollT = 0, isEnd = false, bPlay = true) {
        this.ib_bar.active = false;
        this.node_win_big.active = true;
        this.node_win_big.children.forEach((node) => {
            node.active = false;
        })

        if (!type) {
            let bet = Math.floor(award / wbsgame.gameMgr.getTotalBitNum());
            if (bet < 3) type = 1;
            else type = 2;
        }
        if (bPlay) {
            if (isEnd) {
                wbsgame.audioMgr.playSound("prizeInfobarTotalwin")
            } else {
                wbsgame.audioMgr.playSound("prizeSmallwinMultiplied");
            }
        }

        if (type == 1) {
            let ib_bar_a = xNodeWBS.find("ib_bar_a", this.node_win_big);
            ib_bar_a.active = true;
            let ib_sw_vfx_a_screen_00 = xNodeWBS.find("ib_sw_vfx_a_screen_00", ib_bar_a);
            ib_sw_vfx_a_screen_00.active = true;
            ib_sw_vfx_a_screen_00.getComponent(Animation).play();
        } else if (type == 2) {
            if (!isEnd) {
                wbsgame.audioMgr.playSound("prizeSmallwinMultipliedCoins");
            }
            let ib_bar_b = xNodeWBS.find("ib_bar_b", this.node_win_big);
            ib_bar_b.active = true;
            let ib_mw_vfx_a_screen_00 = xNodeWBS.find("ib_mw_vfx_a_screen_00", ib_bar_b);
            ib_mw_vfx_a_screen_00.active = true;
            ib_mw_vfx_a_screen_00.getComponent(Animation).play();

            let ib_mw_vfx_d_normal_00 = xNodeWBS.find("ib_mw_vfx_d_normal_00", this.node_win_big);
            ib_mw_vfx_d_normal_00.active = true;
            ib_mw_vfx_d_normal_00.getComponent(Animation).play();

            let ib_mw_vfx_f_g = xNodeWBS.find("ib_mw_vfx_f_g", this.node_win_big);
            ib_mw_vfx_f_g.active = true;
            ib_mw_vfx_f_g.getComponent(Animation).play();
        } else if (type == 3) {
            let ib_bar_c = xNodeWBS.find("ib_bar_c", this.node_win_big);
            ib_bar_c.active = true;
        }

        let ib_vfx_c_add_00 = xNodeWBS.find("ib_vfx_c_add_00", this.node_win_big);
        ib_vfx_c_add_00.active = true;
        ib_vfx_c_add_00.getComponent(Animation).play();
        let num_info = xNodeWBS.find("num_info", this.node_win_big);
        num_info.active = true;
        if (rollT > 0) {
            xNodeWBS.setLabelRollAni(xNodeWBS.findComponent("num_info", num_info, Label), award, 0, rollT);
        } else {
            xNodeWBS.setLabel("num_info", num_info, showMoney(award));
        }
        let info_win = xNodeWBS.find("info_win", num_info);
        info_win.getComponent(WBSSpriteCtrl).sprIndex = isEnd ? 1 : 0;

    }
    changePanel(id) {
        const shown = id === 1 ? this.panel1 : this.panel2;
        const hidden = id === 1 ? this.panel2 : this.panel1;
        Tween.stopAllByTarget(shown);
        Tween.stopAllByTarget(hidden);
        // Creator 3.8 pauses Node tweens while inactive: activate before creating the tween.
        shown.active = true;
        shown.position = new Vec3(0, this.panelRestY - 220, 0);
        tween(hidden).to(0.08, { position: new Vec3(0, this.panelRestY - 220, 0) })
            .call(() => { hidden.active = false; }).start();
        tween(shown).to(0.08, { position: new Vec3(0, this.panelRestY, 0) }).start();
    }

    getNodeBigWinPos() {
        return this.node_win_big.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    }
    onClickMenuBtn() {
        if (wbsgame.sendMgr.readOnly) return;
        wbsgame.audioMgr.playSound("menu_icon_press");
        this.changePanel(2);
    }
    onALLMoneyClick() {
        wbsgame.audioMgr.playSound("menu_icon_press");
        wbsgame.gamelayer.popupMenuCtrl.showAllMoneyPanel();
    }

    onBetClick() {
        wbsgame.audioMgr.playSound("menu_icon_press");

        wbsgame.gamelayer.popupMenuCtrl.showBetPanel();
    }

    showTipPanel(type) {
        let tip_panel = xNodeWBS.find("tip_panel", this.node);
        Tween.stopAllByTarget(tip_panel);
        tip_panel.active = true;
        tip_panel.children.forEach((node) => {
            node.active = (node.name == type);
        })
        tween(tip_panel)
            .to(0.3, { scale: new Vec3(1.1, 1.1, 1.1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .delay(1)
            .call(() => {
                tip_panel.active = false;
            })
            .start()
    }
}

