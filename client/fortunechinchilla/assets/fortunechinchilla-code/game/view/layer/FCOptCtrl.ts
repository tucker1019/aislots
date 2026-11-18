import { _decorator, Component, Node, Button, Label, Toggle, TERRAIN_HEIGHT_BASE, Tween, InstancedBuffer, Sprite, NodeEventType, tween, Color, find, Animation, isValid, sys, UITransform, Vec3, sp, UIOpacity, instantiate } from 'cc';
import { fcframe } from '../../../fcframe/fcframe';

import { xNodeFC } from '../../../xtools/xNodeFC';
import { FCBaseNode } from '../../base/FCBaseNode';
import { __, formatStr, recovMoney, showMoney } from '../../common/FCUtils';
import { FCConstant, FCSTATE } from '../../FCConstant/FCConstant';

import FCLoadManager from '../../load/FCLoadManager';
import { FCGameManager } from '../../mgr/FCGameManager';
import { alertGame } from '../../net/FCGameUI';
import { AutoSpinPage } from '../../ui/auto_spin_page';
import { BetOptionsPage } from '../../ui/bet_options_page';
import { buildChoices } from '../../ui/bet_choices';
import { RulesPage } from '../../ui/rules_page';
import { FCGame } from '../scenes/FCGame';
import { FCAudioMgr } from './FCAudioMgr';
import { FCConfigCtrl } from './FCConfigCtrl';
import { FCGameEvent } from './FCGameEvent';
import { FCGameLayerCtrl } from './FCGameLayerCtrl';
import { FCGlobal } from './FCGlobal';
import { FCLanguage } from './FCLanguage';
import { FCPlatformMgr } from '../../3rd/FCPlatformMgr';

import { FCSpriteCtrl } from './FCSpriteCtrl';
const { ccclass, property } = _decorator;

export enum OPT_STATE {
    START,
    ROLL,
    ROLL_RESULT_CLICK,
    ROLL_END,
    FREE,
    END,
}

// 游戏操作面板
@ccclass('FCOptCtrl')
export class FCOptCtrl extends FCBaseNode {

    ib_bar: Node = null;    // 跑马灯滚动条
    // ui_footer: Node = null; // 底下老虎须装饰图
    node_win_big: Node = null;  // 玩家赢钱-大横条

    lab_all_money: Label = null;    // 玩家总钱
    lab_bit_bottom: Label = null;   // 当前押注
    lab_award_num: Label = null;    // 当前赢钱

    btn_all: Node = null;    // 总钱点击
    btn_bet: Node = null;    // 押注点击

    panel1: Node = null;    // 第一页panel--包含spin等按钮
    panel2: Node = null;    // 第二页panel--包含rule等按钮

    btn_turbo: Node = null;     // 快速按钮
    subBtnNode: Node = null;    // 减注
    addBtnNode: Node = null;    // 加注
    btn_auto: Node = null;      // 自动
    btn_menu: Node = null;      // 菜单
    btn_go: Node = null;        // 旋转 
    btn_stop: Node = null;      // 停止
    btn_autostop: Node = null;  // 停止自动

    btn_exit: Node = null;      // 退出按钮
    btn_sound: Node = null;     // 音量
    btn_rule: Node = null;      // 规则 
    btn_close: Node = null;     // 关闭panel2

    tip_panel: Node = null;  // 提示条&&赢分条

    curAllMoney: number = 0; // 当前玩家总钱

    layerCtrl: FCGameLayerCtrl = null;

    // @property(Node)
    // private node_lines: Node = null;
    // @property(Label)
    // private lab_bit_top: Label = null;
    // @property(Label)
    // private lab_bit_bottom: Label = null;
    // @property(Node)
    // private node_btn_win: Node = null;

    // node_bit: Node = null
    // showLineBool: boolean = false

    isAutoShow: boolean = false
    btn_mask: Node = null
    // layout_auto: Node = null

    _spinButtonSp: sp.Skeleton = null;

    _canSendSpin: boolean = true;
    set canSendSpin(bVal: boolean) {
        this._canSendSpin = bVal;
    }
    get canSendSpin() {
        return this._canSendSpin;
    }

    _isTouchGo: boolean = false; // 是否开始触摸go按钮
    set isTouchGo(isTouchGo) {
        this._isTouchGo = isTouchGo;
        if (!isTouchGo) {
            if (FCGameManager.getState() == FCSTATE.READY) {
                this.updateGoBtnAnim();
            }
        }
    }
    get isTouchGo() {
        return this._isTouchGo
    }

    protected initAttribute() {

    }

    onLoad(): void {

        this.canSendSpin = true;

        this.ib_bar = xNodeFC.find("ib_bar", this.node);
        // this.ui_footer = xNodeFC.find("ui_footer_a", this.node);
        this.node_win_big = xNodeFC.find("node_win_big", this.node);
        this.lab_all_money = xNodeFC.findComponent("node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeFC.findComponent("node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeFC.findComponent("node_win/lab", this.node, Label);
        this.btn_all = xNodeFC.find("node_all", this.node);
        this.btn_bet = xNodeFC.find("node_bet", this.node);

        this.panel1 = xNodeFC.find("panel1", this.node);
        this.panel2 = xNodeFC.find("panel2", this.node);

        this.btn_turbo = xNodeFC.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeFC.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeFC.find("panel1/btn_add", this.node);
        this.btn_auto = xNodeFC.find("panel1/btn_auto_panel", this.node);
        this.btn_menu = xNodeFC.find("panel1/btn_menu", this.node);
        this.btn_go = xNodeFC.find("panel1/btn_go", this.node);
        this.btn_stop = xNodeFC.find("panel1/btn_stop", this.node);
        this.btn_autostop = xNodeFC.find("panel1/btn_autostop", this.node);

        this.btn_exit = xNodeFC.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeFC.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeFC.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeFC.find("panel2/btn_close", this.node);

        this.tip_panel = xNodeFC.find("tip_panel", this.node);
        this.tip_panel.active = false;

        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FCGameLayerCtrl);


        this._spinButtonSp = xNodeFC.findComponent("panel1/button", this.node, sp.Skeleton);


        // this.node_bit = xNodeFC.find("node_bit", this.node)
        this.btn_mask = xNodeFC.find("btn_mask", this.node)
        // this.layout_auto = xNodeFC.find("layout_auto", this.node)
    }
    initBtnClick() {
        xNodeFC.addClick("", this.btn_all, this.onALLMoneyClick.bind(this));
        xNodeFC.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeFC.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeFC.addClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeFC.addClick("", this.subBtnNode, this.onSubBtnClick.bind(this));
        xNodeFC.addClick("", this.btn_auto, this.showSetAudo.bind(this));
        xNodeFC.addClick("", this.btn_menu, this.onMenuClick.bind(this));

        xNodeFC.addClick("", this.btn_stop, this.onStopRollClick.bind(this));
        xNodeFC.addClick("", this.btn_autostop, this.onStopAudoRollClick.bind(this));

        xNodeFC.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeFC.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeFC.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        xNodeFC.addClick('panel2/btn_history', this.node, () => this.layerCtrl.showHistory());
        xNodeFC.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));

        xNodeFC.addClick("qp", this.node, this.hideQipaoPanel.bind(this));
        xNodeFC.addClick("qp/an", this.node, () => FCPlatformMgr.pay(0));
        xNodeFC.addClick("qp/an1", this.node, () => FCPlatformMgr.toVip());
        if (FCGlobal.LANG == "id_ID") {
            xNodeFC.setRichText("qp/RichText", this.node, "Top up apa pun untuk mendapatkan <color=#00FF1F>VIP</color> dan buka benefit lebih tinggi");
        } else if (FCGlobal.LANG == "es_MX") {
            xNodeFC.setRichText("qp/RichText", this.node, "Recarga cualquier monto para obtener el  <color=#00FF1F>VIP</color> y desbloquear beneficios más altos.");
        } else {
            xNodeFC.setRichText("qp/RichText", this.node, "Top up any amount to become a <color=#00FF1F>VIP</color> and unlock greater benefits.");
        }
    }
    hideQipaoPanel() {
        xNodeFC.hide("qp", this.node);
    }
    initLanguageView() {
        // xNodeFC.find("btn_auto_panel", this.node).getComponent(UITransform).width = FCPlatformMgr.getLanguage() == "en" ? 100 : 180;
        // let path = FCConstant.languagePath;        
        // xNodeFC.setSpriteFrame("btn_go/spr_spin", this.node, FCLoadManager.ins.getSpriteFrame(path + "img_spin/spriteFrame"))
        // xNodeFC.setSpriteFrame("btn_stop/img_stop", this.node, FCLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFC.setSpriteFrame("btn_autostop/img_stop", this.node, FCLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFC.setSpriteFrame("btn_turbo", this.node, FCLoadManager.ins.getSpriteFrame(path + "btn_fast_off/spriteFrame"))
        // xNodeFC.setSpriteFrame("btn_turbo/spr_fast", this.node, FCLoadManager.ins.getSpriteFrame(path + "btn_fast_on/spriteFrame"))
        // xNodeFC.setLabel("lab_title", this.node, FCConfigCtrl.Instance.getLanguageText(FCLanguage.WIN));
        // xNodeFC.setLabel("btn_go/lab_wenzi", this.node, FCConfigCtrl.Instance.getLanguageText(FCLanguage.HOLD_FOR_AUTOSPIN));
        // xNodeFC.setLabel("btn_line/lab_title", this.node, FCConfigCtrl.Instance.getLanguageText(FCLanguage.LINES));
        // xNodeFC.setLabel("node_bit/lab_top_title", this.node, FCConfigCtrl.Instance.getLanguageText(FCLanguage.LINE_PLAY));
        // xNodeFC.setLabel("node_bit/lab_bottom_title", this.node, FCConfigCtrl.Instance.getLanguageText(FCLanguage.TOTAL_PLAY));
    }

    showNorTitle(bShow, state?) {


        this.ib_bar.active = true;
        if (bShow) {
            this.ib_bar.getComponent(UIOpacity).opacity = 255;
            let info_main = xNodeFC.find("mask/info_main", this.ib_bar);

            let playInfoAnim = (showInfo) => {
                Tween.stopAllByTarget(info_main);
                let maskW = xNodeFC.find("mask", this.ib_bar).getComponent(UITransform).contentSize.width;
                let infoW = showInfo.getComponent(UITransform).contentSize.width;
                if (infoW > maskW) {
                    showInfo.position = new Vec3((infoW - maskW) / 2 + 30, showInfo.position.y);
                    tween(showInfo)
                        .delay(0.5)
                        .to(4.4, { position: new Vec3(-(maskW + infoW) / 2 - 5, showInfo.position.y, 0) })
                        .start()
                } else {
                    showInfo.position = new Vec3(0, showInfo.position.y, 0);
                }
            }

            if (state == "triFree") {
                Tween.stopAllByTarget(this.ib_bar);
                info_main.active = true;
                info_main.getComponent(FCSpriteCtrl).setSpriteIndex(3);
                playInfoAnim(info_main);
            } else {
                if (state == "init" || this.node_win_big.active) {
                    Tween.stopAllByTarget(this.ib_bar);
                    info_main.active = true;
                    let showIdx = Math.floor(Math.random() * 3);
                    tween(this.ib_bar)
                        .repeatForever(
                            tween().call(() => {
                                Tween.stopAllByTarget(info_main);
                                info_main.getComponent(FCSpriteCtrl).setSpriteIndex(showIdx);
                                showIdx = showIdx + 1;
                                if (showIdx == 3) {
                                    showIdx = 0;
                                }
                                playInfoAnim(info_main);
                            }).delay(5)
                        )
                        .start()
                }
            }

            this.node_win_big.active = false;
        } else {
        }

    }

    start() {
        this.initAttribute();
        this.initBtnClick();
        this.initLanguageView()
        this.onTouch()
        this.updateGoBtnAnim();
        this.showNorTitle(true, "init");
        this.initTurboBtn();
        this.initSoundBtn();
    }

    updateBitView(index: number = FCGameManager.getTotalBitIndex(), bClick = false) {

        let mMultiples: number[] = FCGameManager.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = index >= max;
        let minBool = index <= min;
        index = Math.min(index, max);
        index = Math.max(index, min);
        xNodeFC.setBtnInteractable("", this.addBtnNode, !maxBool);
        xNodeFC.setBtnInteractable("", this.subBtnNode, !minBool);
        FCGameManager.setTotalBitIndex(index);
        // xNodeFC.setLabel("", this.lab_bit_top.node, showMoney(FCGameManager.getBitNum()*FCGameManager.getBitMult(), false));
        xNodeFC.setLabel("", this.lab_bit_bottom.node, showMoney(FCGameManager.getTotalBitNum()));


        if (bClick) {
            if (index == min) {
                this.showTipPanel("min_bet");
            } else if (index == max) {
                this.showTipPanel("max_bet");
            }
        }
        // this.layerCtrl.centerRollCtrl.updateBonusCntView();
    }

    setStartBit(noMoney = false) {
        if (FCGlobal.playerType == 0) {
            FCGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
            return;
        }
        let gold = FCGlobal.USER.gold;
        if (FCGlobal.MODE == "fun") gold = FCGlobal.USER.experienceGold;


        let mMultiples: number[] = FCGameManager.getTotalBitList() || [];
        if (!mMultiples || mMultiples.length == 0) {
            return
        }

        let localBet = Number(fcframe.storage.get(`${FCGlobal.USER.uid}_${FCConstant.GAMEID}_${FCGlobal.LEAVE}`));
        let localMult = Number(fcframe.storage.get(`${FCGlobal.USER.uid}_${FCConstant.GAMEID}_${FCGlobal.LEAVE}_MULT`)) || 0;

        if (localBet && localMult) {
            localBet--;
            localMult--;
            FCGameManager.setBitIndex(localBet);
            FCGameManager.setBitMultIndex(localMult);
            let total = FCGameManager.getTotalBitIndexBy(localBet, localMult);
            FCGameManager.setTotalBitIndex(total);
            this.updateBitView(total);
        }
        else {
            let n: number[] = [];;
            for (let i = mMultiples.length - 1; i >= 0; i--) {
                n[i] = Math.abs(mMultiples[i] - gold * 0.01);
            }
            let min = Math.min(...n);
            let minIndex = n.findIndex(item => item == min);
            FCGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
        }
    }
    checkAudo(isEnd: boolean = true) {
        let stop = false;
        if (isEnd) {


            console.log("==========>>stop", stop)
        }
        xNodeFC.setLabel("lab_autoNum", this.btn_autostop, "" + FCGameManager.getAudoNum())
        xNodeFC.setActive("lab_autoNum", this.btn_autostop, FCGameManager.getAudoNum() > 0)
        if (!stop && FCGameManager.getAudoNum() > 0) {
            if (this.layerCtrl.canAffordSpin()) {
                this.scheduleOnce(() => {
                    this.onGoBtnClick();
                }, 0)
            } else {
                FCGameManager.setAudoNum(0);
                alertGame(__("Insufficient balance"))
                this.updateBtnState(true)
            }
        } else {
            if (stop) {
                this.layerCtrl.sysAutoNum = Math.max(0, FCGameManager.getAudoNum());
            }

            FCGameManager.setAudoNum(0)
            this.updateBtnState(true)
        }
    }
    updateStopBtnInteractable(isinter: boolean) {
        xNodeFC.setBtnInteractable("", this.btn_stop, isinter)
    }

    updateBtnState(isshow: boolean) {
        if (isshow) this.canSendSpin = true;
        xNodeFC.setActive("", this.btn_stop, !isshow)
        xNodeFC.setActive("", this.btn_go, isshow)
        if (isshow) {
            this._spinButtonSp.setAnimation(0, "idle1", true);
        }

        // xNodeFC.setActive("", this.btn_auto, isshow)
        xNodeFC.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeFC.setBtnInteractable("", this.addBtnNode, isshow)
        xNodeFC.setBtnInteractable("", this.btn_auto, isshow)
        xNodeFC.setBtnInteractable("", this.btn_menu, isshow)
        // xNodeFC.setBtnInteractable("", this.btn_bet, isshow)
        this.btn_bet.getComponent(Button).interactable = isshow
        this.btn_all.getComponent(Button).interactable = isshow

        // xNodeFC.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFC.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFC.setBtnInteractable("", xNodeFC.find("btn_line", this.node), isshow)
        // xNodeFC.setBtnInteractable("", xNodeFC.find("btn_rule", this.node), isshow)
        this.updateBtnAudo();
        if (isshow) this.updateBitView()

        this.updateGoBtnAnim();
    }
    updateBtnAudo() {
        let isAudo = FCGameManager.getAudoNum() > 0;
        if (isAudo) xNodeFC.hide("", this.btn_go)
        // if (isAudo) xNodeFC.hide("", this.btn_auto)
        if (isAudo) xNodeFC.hide("", this.btn_stop)
        xNodeFC.setActive("", this.btn_autostop, isAudo)
        xNodeFC.setBtnInteractable("", this.btn_autostop, isAudo)
    }

    onTouch() {
        this.btn_go.on(NodeEventType.TOUCH_START, (e) => {
            this.touchCallBack(e)
        })
        this.btn_go.on(NodeEventType.TOUCH_MOVE, (e) => {
            this.touchCallBack(e)
        })
        this.btn_go.on(NodeEventType.TOUCH_END, (e) => {
            this.touchCallBack(e)
        })
        this.btn_go.on(NodeEventType.TOUCH_CANCEL, (e) => {
            this.touchCallBack(e)
        })
    }

    touchCallBack(event: Event) {
        // let guangAnim: Animation = xNodeFC.findComponent("mh_vfx_a", this.btn_go, Animation);
        switch (event.type) {
            case "touch-start":
                this._spinButtonSp.setAnimation(0, "idle2", true)
                // guangAnim.node.active = true;
                // guangAnim.play();
                // this.isAutoShow = true;
                // this.scheduleOnce(this.showSetAudo, 1)
                this.isTouchGo = true;
                break;
            case "touch-move":

                break;
            case "touch-end":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                // guangAnim.node.active = false;
                // if (!this.layout_auto.active) {
                this.onGoBtnClick(true)
                // }
                this.isTouchGo = false;
                break;
            case "touch-cancel":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                // guangAnim.node.active = false;
                this._spinButtonSp.setAnimation(0, "idle1", true)
                this.isTouchGo = false;
                break;
        }
    }
    setBtnMaskActive(isShow: boolean = false) {
        this.btn_mask.active = isShow;

        if (!isShow) {
            this.isTouchGo = false;
        }
    }

    // setAutoActive(isShow: boolean = false) {
    //     this.layout_auto.active = isShow;
    // }


    showSetAudo() {
        if (this.layerCtrl.isReplay || FCGameManager.getState() !== FCSTATE.READY || !this.canSendSpin || !this.btn_go.active) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.autoPage ??= new AutoSpinPage(canvas, count => this.onAutoSelectClick(count), () => ({
            balance: showMoney(FCGlobal.USER.gold),
            bet: showMoney(FCGameManager.getTotalBitNum(), false),
        }), () => FCAudioMgr.Instance.playSound('games/Click'))).open();
    }


    playWinAni() {
        // let ani: Animation = xNodeFC.findComponent("winbgani", this.node, Animation);
        // if (isValid(ani)) {
        //     xNodeFC.show("", ani.node)
        //     ani.play();
        //     this.scheduleOnce(() => { xNodeFC.hide("", ani.node) }, 0.42)
        // }
    }
    setAwardNum(award: number, rollT = 0, bSpecial = false) {
        this.showNorTitle(false);

        if (award == 0) {
            this.lab_award_num.string = "0";
            return
        }
        let awardbefor = recovMoney(this.lab_award_num.string);
        if (awardbefor == award) return;
        let showaward = awardbefor;
        // this.playWinAni();
        Tween.stopAllByTarget(this.lab_award_num.node);
        if (rollT > 0) {
            xNodeFC.setLabelRollAni(this.lab_award_num, award, awardbefor, rollT);
            this.setBigAwardNum(award, bSpecial ? 3 : null, true);
        } else {
            this.lab_award_num.string = showMoney(award, false);
        }
    }

    setBigAwardNum(award, winType?, isFirst?) {
        if (award > 0) {
            isFirst = isFirst || !this.node_win_big.active;
            this.node_win_big.active = true;
            if (!winType) {
                let bitNum = FCGameManager.getTotalBitNum();
                winType = FCGameManager.getWinType(award, bitNum);
            }
            // FCAudioMgr.Instance.playSound("games/result1");
            let ib_bar_opa = this.ib_bar.getComponent(UIOpacity);
            tween(ib_bar_opa).to(0.3, { opacity: 0 }).start()
            if (isFirst) {
                this.node_win_big.children.forEach((node) => { node.active = false; });
                if (winType < 3) {
                    FCAudioMgr.Instance.playSound("games/Win" + (winType + 1));
                    let showBgOpa: UIOpacity = xNodeFC.findComponent("ib_bar_b", this.node_win_big, UIOpacity);
                    showBgOpa.node.active = true;
                    showBgOpa.opacity = 0;
                    tween(showBgOpa)
                        .to(0.3, { opacity: 255 }).start()
                } else {
                    FCAudioMgr.Instance.playSound("games/Notify_UI");
                    let showBgOpa: UIOpacity = xNodeFC.findComponent("ib_bar_c", this.node_win_big, UIOpacity);
                    showBgOpa.node.active = true;
                    showBgOpa.opacity = 0;
                    tween(showBgOpa)
                        .to(0.3, { opacity: 255 }).start()

                    let mw_d_anim: Animation = xNodeFC.findComponent("ib_mw_vfx_d_add", this.node_win_big, Animation);
                    mw_d_anim.node.active = true;
                    mw_d_anim.play("win_mw_d");

                    let mw_e = xNodeFC.find("ib_mw_vfx_e_add", this.node_win_big);
                    mw_e.active = true;

                    let mw_c_anim: Animation = xNodeFC.findComponent("ib_mw_vfx_c_normal_00", this.node_win_big, Animation);
                    mw_c_anim.node.active = true;
                    mw_c_anim.play("win_mw_c");

                    let mw_b_anim: Animation = xNodeFC.findComponent("ib_mw_vfx_b_add_00", this.node_win_big, Animation);
                    mw_b_anim.node.active = true;
                    mw_b_anim.play("win_mw_b");
                }
            }

            let vfx_c_Opa: UIOpacity = xNodeFC.findComponent("ib_vfx_c_add", this.node_win_big, UIOpacity);
            vfx_c_Opa.node.active = true;
            vfx_c_Opa.opacity = 0;
            tween(vfx_c_Opa)
                .to(0.3, { opacity: 255 }).start()

            if (isFirst) {
                let vfx_b_anim: Animation = xNodeFC.findComponent("ib_vfx_b_add_00", this.node_win_big, Animation);
                vfx_b_anim.node.active = true;
                vfx_b_anim.play("win_vfx_b");
            }

            let vfx_d_anim: Animation = xNodeFC.findComponent("ib_vfx_d_add_00", this.node_win_big, Animation);
            vfx_d_anim.node.active = true;
            vfx_d_anim.play("win_vfx_d");

            let vfx_a_anim: Animation = xNodeFC.findComponent("ib_vfx_a_screen", this.node_win_big, Animation);
            vfx_a_anim.node.active = true;


            let num_info = xNodeFC.find("num_info", this.node_win_big);
            num_info.active = true;
            xNodeFC.setLabel("", num_info, showMoney(award));
            tween(num_info)
                .delay(0.1)
                .to(0.2, { scale: new Vec3(1.1, 1.1) })
                .to(0.2, { scale: new Vec3(1, 1) })
                .start()

        } else {
            this.node_win_big.active = false;
        }

    }

    initTurboBtn() {
        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");
        node_off.active = true;
        node_on.active = false;
        FCGameManager.setFast(false);
    }

    /**修改速度 */
    onTurboClick() {
        FCAudioMgr.Instance.playSound("games/Click");
        // FCAudioMgr.Instance.playSound("button/MaxBetButton")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")

        FCGameManager.setFast(node_on.active)
    }

    onAddBtnClick() {
        if (FCGlobal.playerType == 0) {
            xNodeFC.show("qp", this.node);
            this.unschedule(this.hideQipaoPanel);
            this.scheduleOnce(this.hideQipaoPanel, 6);
            return;
        }
        // FCAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FCGameManager.getTotalBitIndex() + 1, true);
    }

    onSubBtnClick() {
        // FCAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FCGameManager.getTotalBitIndex() - 1, true);
    }

    async onGoBtnClick(bCLick = false) {
        if (bCLick) {
            if (FCGameManager.getWinAllMoneyR() > 0) {
                FCAudioMgr.Instance.playSound("games/Spin2")
            } else {
                FCAudioMgr.Instance.playSound("games/Spin1")
            }
        }
        this.unschedule(this.hideQipaoPanel);
        this.hideQipaoPanel();
        if (FCGameManager.getState() !== FCSTATE.READY || !this.canSendSpin || this.layerCtrl.isReplay) return;

        if (this.layerCtrl.canAffordSpin()) {
            if (!this.canSendSpin) return
            this.canSendSpin = false;

            FCAudioMgr.Instance.stopLongEffect("games/Prize_Stop");
            // 钱没滚完
            if (FCGameManager.getWinAllMoneyR() > 0 && recovMoney(this.lab_award_num.string) != FCGameManager.getWinAllMoneyR()) {
                this.setAwardNum(FCGameManager.getWinAllMoneyR());
                this.scheduleOnce(() => {
                    this.setAwardNum(0);
                    this.showNorTitle(true);
                }, 0.2)
            } else {
                this.setAwardNum(0);
                this.showNorTitle(true);
            }
            FCGameManager.setWinAllMoneyR(0);

            const stake = this.layerCtrl.stake;
            this.layerCtrl.centerRollCtrl.startRotation();
            this.updateBtnState(false);
            FCGameManager.setState(FCSTATE.RUNNING);
            void this.layerCtrl.playPaidSpin(stake);

            // 手动点击spin按钮
            if (bCLick) {
                this.playStopShow();
            }
            // await this.layerCtrl.centerRollCtrl.initLight();
        } else {
            alertGame(__("Insufficient balance"))
        }
    }

    onAutoSelectClick(custom) {
        if (custom && this.btn_go.active && this.canSendSpin && !this.layerCtrl.isReplay && FCGameManager.getState() === FCSTATE.READY) {
            FCGameManager.setAudoNum(Number(custom))
            this.checkAudo(false);
            // this.setAutoActive(false);
            this.setBtnMaskActive(false);
        }
    }

    onBtnMaskClick() {
        // let autoNode = xNodeFC.find("layout_auto", this.node);
        // if (autoNode.active == true) {
        //     autoNode.active = false;
        //     this.setBtnMaskActive(false);
        // } else {
        //     this.setBtnMaskActive(false);
        // }
    }
    onStopAudoRollClick() {
        FCAudioMgr.Instance.playSound("games/Click");
        FCGameManager.setAudoNum(0);
        xNodeFC.hide("", this.btn_autostop)
        xNodeFC.setActive("", this.btn_stop, FCGameManager.getState() != FCSTATE.READY)
        xNodeFC.setActive("", this.btn_go, FCGameManager.getState() == FCSTATE.READY)
        // xNodeFC.setActive("", this.btn_auto, FCGameManager.getState() == FCSTATE.READY)

        this.updateGoBtnAnim();
    }
    /**手动停止滚动/停止自动滚动 */
    onStopRollClick() {
        if (FCGameManager.getStop()) return
        FCAudioMgr.Instance.playSound("games/Click");
        FCGameManager.setStop(true);
        // xNodeFC.find("sb_arrow_blur", this.btn_stop).active = false;
        // xNodeFC.find("sb_arrow_grey", this.btn_stop).active = true;
        this._spinButtonSp.setAnimation(0, "idle3", false)
    }
    // 播放apin按钮按下后，stop按钮动画
    playStopShow() {
        // tween(this.btn_stop)
        //     .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
        //     .to(0.3, { scale: new Vec3(1, 1, 1) })
        //     .start()

        // xNodeFC.find("sb_arrow_blur", this.btn_stop).active = true;
        // xNodeFC.find("sb_arrow_grey", this.btn_stop).active = false;

        // let starAnim: Animation = xNodeFC.findComponent("", this.btn_stop, Animation);
        // starAnim.play();


        this._spinButtonSp.setAnimation(0, "click", false)
        this._spinButtonSp.addAnimation(0, "idle1", true)

        // this.playSpinFooterAnim();
    }
    onLineBtnClick() {
        // FCAudioMgr.Instance.playSound("button/InfoButton");
        // if (this.showLineBool) FCLoadManager.ins.hideLineLayer();
        // else FCLoadManager.ins.showLineLayerWitnInit(null, this.layerCtrl.lineNode);
        // this.showLineBool = !this.showLineBool
    }

    changeFreeState(isFree: boolean = false) {
        xNodeFC.setActive("tip_panel", this.node, isFree);
        xNodeFC.setActive("lab_free", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFC.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFC.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFC.setActive("btn_stop", this.node, !isFree);
        // xNodeFC.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateBonusNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFC.setLabel("lab_bonus", this.node, lab);
    }

    changeBonusState(isFree: boolean = false) {
        xNodeFC.setActive("tip_panel", this.node, isFree);
        xNodeFC.setActive("lab_bonus", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFC.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFC.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFC.setActive("btn_stop", this.node, !isFree);
        // xNodeFC.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateFreeNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFC.setLabel("lab_free", this.node, lab);
    }

    getAwardNumPos() {
        return this.lab_award_num.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    }

    getWinBigPos() {
        return xNodeFC.find("num_info", this.node_win_big).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    }

    updateGoBtnAnim() {
        // let spr_spin = this.btn_go.getChildByName("spr_spin");
        // Tween.stopAllByTarget(spr_spin);

        // if (this.isTouchGo) {
        //     return;
        // }

        // spr_spin.eulerAngles = new Vec3(0, 0, 0);
        // if (this.btn_go.active) {
        //     tween(spr_spin)
        //         .repeatForever(
        //             tween().delay(2)
        //                 .call(() => {
        //                     if (this.isTouchGo) {
        //                         Tween.stopAllByTarget(spr_spin);
        //                     }
        //                 })
        //                 .by(0.5, { eulerAngles: new Vec3(0, 0, -30) })
        //                 .by(0.5, { eulerAngles: new Vec3(0, 0, 30) }, { easing: "bounceOut" })
        //                 .call(() => {
        //                     if (this.isTouchGo) {
        //                         Tween.stopAllByTarget(spr_spin);
        //                     }
        //                 })
        //         )
        //         .start()
        // }
    }



    // 刷新总钱
    setAllNum(nums: number = null) {
        Tween.stopAllByTarget(this.lab_all_money.node);
        let num = nums;
        if (!nums) {
            num = FCGlobal.USER.gold
        }
        // if (this.curAllMoney != num) {
        //     let ani: Animation = xNodeFC.findComponent("goldAni", this.node.parent, Animation);
        //     if (isValid(ani)) {
        //         xNodeFC.show("", ani.node)
        //         ani.play();
        //         this.scheduleOnce(() => {
        //             xNodeFC.hide("", ani.node)
        //         }, 0.64)
        //     }
        // }
        this.curAllMoney = num;
        this.lab_all_money.string = this.layerCtrl?.isReplay ? "******" : showMoney(num);
    }


    // playSpinFooterAnim() {
    //     this.ui_footer.getComponent(Animation).play();
    // }

    showTipPanel(type) {
        Tween.stopAllByTarget(this.tip_panel);
        this.tip_panel.active = true;
        this.tip_panel.children.forEach((node) => {
            node.active = (node.name == type);
        })
        tween(this.tip_panel)
            .to(0.3, { scale: new Vec3(1.1, 1.1, 1.1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .delay(1)
            .call(() => {
                this.tip_panel.active = false;
            })
            .start()
    }

    changePanel(id) {

        let changeT = 0.08;
        if (id == 1) {
            // let footerOpa = this.ui_footer.getComponent(UIOpacity);
            // this.ui_footer.active = true;
            // footerOpa.opacity = 0;
            // tween(footerOpa)
            //     .to(changeT, { opacity: 255 }).start()
            tween(this.panel2)
                .to(changeT, { position: new Vec3(0, -320, 0) })   //  todo
                .call(() => {
                    this.panel2.active = false;
                })
                .start()

            tween(this.panel1)
                .delay(changeT)
                .call(() => {
                    this.panel1.active = true;
                    this.panel1.position = new Vec3(0, -320, 0)
                })
                .to(changeT, { position: new Vec3(0, -111, 0) })   //  todo
                .start()

        } else {
            // let footerOpa = this.ui_footer.getComponent(UIOpacity);
            // footerOpa.opacity = 255;
            // tween(footerOpa)
            //     .to(changeT, { opacity: 255 })
            //     .call(() => {
            //         this.ui_footer.active = false;
            //     })
            //     .start()
            tween(this.panel1)
                .to(changeT, { position: new Vec3(0, -320, 0) })   //  todo
                .call(() => {
                    this.panel1.active = false;
                })
                .start()

            tween(this.panel2)
                .delay(changeT)
                .call(() => {
                    this.panel2.active = true;
                    this.panel2.position = new Vec3(0, -320, 0)
                })
                .to(changeT, { position: new Vec3(0, -111, 0) })   //  todo
                .start()
        }
    }

    onMenuClick() {
        FCAudioMgr.Instance.playSound("games/Click");
        this.changePanel(2);
    }


    onBtnExit() {
        FCAudioMgr.Instance.playSound("games/Click");
        this.layerCtrl.onBtnExit();
    }



    initSoundBtn() {
        xNodeFC.find("ic_soundon", this.btn_sound).active = fcframe.audio.getSwitchMusic();
        xNodeFC.find("ic_soundoff", this.btn_sound).active = !fcframe.audio.getSwitchMusic();
    }

    onSoundBtnClick() {
        FCAudioMgr.Instance.playSound("games/Click");
        // FCAudioMgr.Instance.playSound("button/InfoButton");

        let ic_soundon = xNodeFC.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeFC.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        fcframe.audio.setSwitchMusic(ic_soundon.active);
        fcframe.audio.setSwitchEffect(ic_soundon.active);

    }


    onRuleBtnClick() {
        FCAudioMgr.Instance.playSound('games/Click');
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        void (this.rulesPage ??= new RulesPage(canvas)).open();
    }

    onCloseBtnClick() {
        FCAudioMgr.Instance.playSound("games/Click");
        this.changePanel(1);
    }

    onALLMoneyClick() {
        FCAudioMgr.Instance.playSound("games/Click");
        this.layerCtrl.popupMenuCtrl.showAllMoneyPanel();
    }

    onBetClick() {
        FCAudioMgr.Instance.playSound("games/Click");
        if (FCGlobal.playerType == 0) {
            FCPlatformMgr.pay();
            return;
        }
        if (this.layerCtrl.isReplay || FCGameManager.getState() !== FCSTATE.READY || !this.canSendSpin) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.betPage ??= new BetOptionsPage(canvas, () => ({
            choices: buildChoices(FCGameManager.getMultiples().map(String), FCGameManager.lineCount, FCGameManager.betLevel),
            bet: String(FCGameManager.getBitNum()),
            level: FCGameManager.getBitMultIndex() + 1,
            lines: FCGameManager.lineCount,
            balance: String(FCGlobal.USER.gold),
        }), (bet, level) => {
            const index = FCGameManager.getMultiples().indexOf(Number(bet));
            if (index < 0 || level < 1 || level > FCGameManager.betLevel) return;
            this.updateBitView(FCGameManager.getTotalBitIndexBy(index, level - 1));
            // Totals are deduplicated, but retain the base and level the player confirmed.
            FCGameManager.setBitIndex(index);
            FCGameManager.setBitMultIndex(level - 1);
        }, () => FCAudioMgr.Instance.playSound('games/Click'))).open();
    }

    recoverNormal() {
        this.panel1.active = true;
        this.panel2.active = false;
        xNodeFC.find("panel3", this.node).active = false;
    }

    initSpecialCnt(cnt) {
        if (cnt > 0) {
            this.panel1.active = false;
            this.panel2.active = false;

            xNodeFC.find("panel3", this.node).active = true;

            xNodeFC.find("panel3/rfs", this.node).active = cnt > 0;
            xNodeFC.find("panel3/lfs", this.node).active = cnt == 0;
            xNodeFC.setLabel("panel3/rfs/lab", this.node, cnt);
        }
    }

    updateSpecialCnt(cnt) {
        xNodeFC.find("panel3/rfs", this.node).active = cnt > 0;
        xNodeFC.find("panel3/lfs", this.node).active = cnt == 0;
        xNodeFC.setLabel("panel3/rfs/lab", this.node, cnt);
    }


    onDestroy() {
        this.rulesPage?.close();
        this.betPage?.destroy();
        this.autoPage?.destroy();
        super.onDestroy()

    }
private rulesPage?: RulesPage;

private betPage?: BetOptionsPage;

private autoPage?: AutoSpinPage;

}

