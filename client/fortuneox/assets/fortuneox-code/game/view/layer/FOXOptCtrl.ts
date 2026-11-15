import { alertGame } from '../../net/FOXGameUI';
import { AutoSpinPage } from '../../ui/auto_spin_page';
import { BetOptionsPage } from '../../ui/bet_options_page';
import { buildChoices } from '../../ui/bet_choices';
import { RulesPage } from '../../ui/rules_page';
import { _decorator, Component, Node, Button, Label, Toggle, TERRAIN_HEIGHT_BASE, Tween, InstancedBuffer, Sprite, NodeEventType, tween, Color, find, Animation, isValid, sys, UITransform, Vec3, sp, UIOpacity } from 'cc';
import { foxframe } from '../../../foxframe/foxframe';

import { xNodeFOX } from '../../../xtools/xNodeFOX';
import { FOXBaseNode } from '../../base/FOXBaseNode';
import { formatStr, recovMoney, showMoney } from '../../common/FOXUtils';
import { FOXConstant, FOXSTATE } from '../../FOXConstant/FOXConstant';

import FOXLoadManager from '../../load/FOXLoadManager';
import { FOXGameManager } from '../../mgr/FOXGameManager';
import { FOXGame } from '../scenes/FOXGame';
import { FOXAudioMgr } from './FOXAudioMgr';
import { FOXConfigCtrl } from './FOXConfigCtrl';
import { FOXGameEvent } from './FOXGameEvent';
import { FOXGameLayerCtrl } from './FOXGameLayerCtrl';
import { FOXGlobal } from './FOXGlobal';
import { FOXLanguage } from './FOXLanguage';
import FOXCenterRollCtrl from './FOXCenterRollCtrl';
import { FOXSpriteCtrl } from './FOXSpriteCtrl';
import { DEV } from 'cc/env';
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
@ccclass('FOXOptCtrl')
export class FOXOptCtrl extends FOXBaseNode {

    @property(Node)
    ib_bar: Node = null;    // 跑马灯滚动条
    // ui_footer: Node = null; // 底下老虎须装饰图

    @property(Node)
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

    layerCtrl: FOXGameLayerCtrl = null;

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
            if (FOXGameManager.getState() == FOXSTATE.READY) {
                this.updateGoBtnAnim();
            }
        }
    }
    get isTouchGo() {
        return this._isTouchGo
    }

    protected initAttribute() {

    }

    private autoPage?: AutoSpinPage;
    private betPage?: BetOptionsPage;
    private rulesPage?: RulesPage;

    onLoad(): void {

        this.canSendSpin = true;

        // this.ib_bar = xNodeFOX.find("ib_bar", this.node);
        // this.ui_footer = xNodeFOX.find("ui_footer_a", this.node);
        // this.node_win_big = xNodeFOX.find("node_win_big", this.node);
        this.lab_all_money = xNodeFOX.findComponent("node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeFOX.findComponent("node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeFOX.findComponent("node_win/lab", this.node, Label);
        this.btn_all = xNodeFOX.find("node_all", this.node);
        this.btn_bet = xNodeFOX.find("node_bet", this.node);

        this.panel1 = xNodeFOX.find("panel1", this.node);
        this.panel2 = xNodeFOX.find("panel2", this.node);

        this.btn_turbo = xNodeFOX.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeFOX.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeFOX.find("panel1/btn_add", this.node);
        this.btn_auto = xNodeFOX.find("panel1/btn_auto_panel", this.node);
        this.btn_menu = xNodeFOX.find("panel1/btn_menu", this.node);
        this.btn_go = xNodeFOX.find("panel1/btn_go", this.node);
        this.btn_stop = xNodeFOX.find("panel1/btn_stop", this.node);
        this.btn_autostop = xNodeFOX.find("panel1/btn_autostop", this.node);

        this.btn_exit = xNodeFOX.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeFOX.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeFOX.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeFOX.find("panel2/btn_close", this.node);

        this.tip_panel = xNodeFOX.find("tip_panel", this.node);
        this.tip_panel.active = false;

        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FOXGameLayerCtrl);




        // this.node_bit = xNodeFOX.find("node_bit", this.node)
        this.btn_mask = xNodeFOX.find("btn_mask", this.node)
        // this.layout_auto = xNodeFOX.find("layout_auto", this.node)
    }
    initBtnClick() {
        xNodeFOX.addClick("", this.btn_all, this.onALLMoneyClick.bind(this));
        xNodeFOX.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeFOX.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeFOX.addClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeFOX.addClick("", this.subBtnNode, this.onSubBtnClick.bind(this));
        xNodeFOX.addClick("", this.btn_auto, this.showSetAudo.bind(this));
        xNodeFOX.addClick("", this.btn_menu, this.onMenuClick.bind(this));

        xNodeFOX.addClick("", this.btn_stop, this.onStopRollClick.bind(this, true));
        xNodeFOX.addClick("", this.btn_autostop, this.onStopAudoRollClick.bind(this));

        xNodeFOX.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeFOX.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeFOX.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        xNodeFOX.addClick("panel2/btn_histroy", this.node, () => this.layerCtrl.showHistory());
        xNodeFOX.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));

        xNodeFOX.addClick("qp", this.node, this.hideQipaoPanel.bind(this));
        xNodeFOX.addClick("qp/an", this.node, () => this.layerCtrl.onBtnShop());


        if (FOXGlobal.LANG == "id_ID") {
            xNodeFOX.setRichText("qp/RichText", this.node, "Top up apa pun untuk mendapatkan <color=#00FF1F>VIP</color> dan buka benefit lebih tinggi");
        } else if (FOXGlobal.LANG == "es_MX") {
            xNodeFOX.setRichText("qp/RichText", this.node, "Recarga cualquier monto para obtener el  <color=#00FF1F>VIP</color> y desbloquear beneficios más altos.");
        } else {
            xNodeFOX.setRichText("qp/RichText", this.node, "Top up any amount to become a <color=#00FF1F>VIP</color> and unlock greater benefits.");
        }

    }
    hideQipaoPanel() {
        xNodeFOX.hide("qp", this.node);
    }
    initLanguageView() {
        // xNodeFOX.find("btn_auto_panel", this.node).getComponent(UITransform).width = FOXPlatformMgr.getLanguage() == "en" ? 100 : 180;
        // let path = FOXConstant.languagePath;        
        // xNodeFOX.setSpriteFrame("btn_go/spr_spin", this.node, FOXLoadManager.ins.getSpriteFrame(path + "img_spin/spriteFrame"))
        // xNodeFOX.setSpriteFrame("btn_stop/img_stop", this.node, FOXLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFOX.setSpriteFrame("btn_autostop/img_stop", this.node, FOXLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFOX.setSpriteFrame("btn_turbo", this.node, FOXLoadManager.ins.getSpriteFrame(path + "btn_fast_off/spriteFrame"))
        // xNodeFOX.setSpriteFrame("btn_turbo/spr_fast", this.node, FOXLoadManager.ins.getSpriteFrame(path + "btn_fast_on/spriteFrame"))
        // xNodeFOX.setLabel("lab_title", this.node, FOXConfigCtrl.Instance.getLanguageText(FOXLanguage.WIN));
        // xNodeFOX.setLabel("btn_go/lab_wenzi", this.node, FOXConfigCtrl.Instance.getLanguageText(FOXLanguage.HOLD_FOR_AUTOSPIN));
        // xNodeFOX.setLabel("btn_line/lab_title", this.node, FOXConfigCtrl.Instance.getLanguageText(FOXLanguage.LINES));
        // xNodeFOX.setLabel("node_bit/lab_top_title", this.node, FOXConfigCtrl.Instance.getLanguageText(FOXLanguage.LINE_PLAY));
        // xNodeFOX.setLabel("node_bit/lab_bottom_title", this.node, FOXConfigCtrl.Instance.getLanguageText(FOXLanguage.TOTAL_PLAY));
    }

    showNorTitle(bShow, state?) {

        if (bShow) {
            this.ib_bar.active = true;
            let info_main = xNodeFOX.find("mask/info_main", this.ib_bar);

            let playInfoMainAnim = () => {
                Tween.stopAllByTarget(info_main);
                let maskW = xNodeFOX.find("mask", this.ib_bar).getComponent(UITransform).contentSize.width;
                let infoW = info_main.getComponent(UITransform).contentSize.width;
                if (infoW > maskW) {
                    info_main.position = new Vec3((infoW - maskW) / 2 + 30, info_main.position.y);
                    tween(info_main)
                        .delay(0.5)
                        .to(4.4, { position: new Vec3(-(maskW + infoW) / 2 - 5, info_main.position.y, 0) })
                        .start()
                } else {
                    info_main.position = new Vec3(0, info_main.position.y, 0);
                }
            }

            if (state == "triFree") {
                Tween.stopAllByTarget(this.ib_bar);
                info_main.getComponent(FOXSpriteCtrl).setSpriteIndex(3);
                playInfoMainAnim();
            } else {
                if (state == "init" || this.node_win_big.active) {
                    let list = [0, 1, 2];
                    let showIdx = Math.floor(Math.random() * list.length);
                    Tween.stopAllByTarget(this.ib_bar);
                    tween(this.ib_bar)
                        .repeatForever(
                            tween().call(() => {
                                Tween.stopAllByTarget(info_main);
                                info_main.getComponent(FOXSpriteCtrl).setSpriteIndex(showIdx);
                                showIdx = showIdx + 1;
                                if (showIdx == list.length) {
                                    showIdx = 0;
                                }
                                playInfoMainAnim();
                            }).delay(5)
                        )
                        .start()
                    info_main.getComponent(FOXSpriteCtrl).setSpriteIndex(showIdx);
                }
            }

            this.node_win_big.active = false;
        } else {
            // this.ib_bar.active = false;
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

    updateBitView(index: number = FOXGameManager.getTotalBitIndex(), bClick = false) {

        let mMultiples: number[] = FOXGameManager.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = index >= max;
        let minBool = index <= min;
        index = Math.min(index, max);
        index = Math.max(index, min);
        xNodeFOX.setBtnInteractable("", this.addBtnNode, !maxBool);
        xNodeFOX.setBtnInteractable("", this.subBtnNode, !minBool);
        if (index !== FOXGameManager.getTotalBitIndex()) FOXGameManager.setTotalBitIndex(index);
        // xNodeFOX.setLabel("", this.lab_bit_top.node, showMoney(FOXGameManager.getBitNum()*FOXGameManager.getBitMult(), false));
        xNodeFOX.setLabel("", this.lab_bit_bottom.node, showMoney(FOXGameManager.visualStake ?? FOXGameManager.getTotalBitNum(), false));


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
        if (FOXGlobal.playerType == 0) {
            FOXGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
            return;
        }
        let gold = FOXGlobal.USER.gold;
        if (FOXGlobal.MODE == "fun") gold = FOXGlobal.USER.experienceGold;


        let mMultiples: number[] = FOXGameManager.getTotalBitList() || [];
        if (!mMultiples || mMultiples.length == 0) {
            return
        }
        let n: number[] = [];;
        for (let i = mMultiples.length - 1; i >= 0; i--) {
            n[i] = Math.abs(mMultiples[i] - gold * 0.01);
        }
        let min = Math.min(...n);
        let minIndex = n.findIndex(item => item == min);
        let localBet = Number(foxframe.storage.get(`${FOXGlobal.USER.uid}_${FOXConstant.GAMEID}_${FOXGlobal.LEAVE}`));
        let localMult = Number(foxframe.storage.get(`${FOXGlobal.USER.uid}_${FOXConstant.GAMEID}_${FOXGlobal.LEAVE}_MULT`));
        localMult = Math.min(localMult, FOXGameManager.getMultIndexs().length - 1);
        if (localBet && localMult) {
            localBet--;
            localMult--;
            FOXGameManager.setBitIndex(localBet);
            FOXGameManager.setBitMultIndex(localMult);
            let total = FOXGameManager.getTotalBitIndexBy(localBet, localMult);
            FOXGameManager.setTotalBitIndex(total);
            this.updateBitView(total);
        }
        else {
            FOXGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
        }
    }
    async checkAudo(isEnd: boolean = true) {
        let stop = false;
   
        xNodeFOX.setLabel("lab_autoNum", this.btn_autostop, "" + FOXGameManager.getAudoNum())
        xNodeFOX.setActive("lab_autoNum", this.btn_autostop, FOXGameManager.getAudoNum() > 0)
        if (!stop && FOXGameManager.getAudoNum() > 0) {
            if (FOXGameManager.canPlay()) {
                this.scheduleOnce(() => {
                    this.onGoBtnClick();
                }, 0)
            } else {
                FOXGameManager.setAudoNum(0);
                alertGame("余额不足，请充值后再试。");
                this.updateBtnState(true)
            }
        } else {
            if (stop) {
                this.layerCtrl.sysAutoNum = Math.max(0, FOXGameManager.getAudoNum());
            }

            FOXGameManager.setAudoNum(0)
            this.updateBtnState(true)
        }
    }
    updateStopBtnInteractable(isinter: boolean) {
        xNodeFOX.setBtnInteractable("", this.btn_stop, isinter)
    }

    updateBtnState(isshow: boolean) {
        if (isshow) this.canSendSpin = true;
        xNodeFOX.setActive("", this.btn_stop, !isshow)
        xNodeFOX.setActive("", this.btn_go, isshow)
        // xNodeFOX.setActive("", this.btn_auto, isshow)
        xNodeFOX.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeFOX.setBtnInteractable("", this.addBtnNode, isshow)
        xNodeFOX.setBtnInteractable("", this.btn_auto, isshow)
        xNodeFOX.setBtnInteractable("", this.btn_menu, isshow)
        // xNodeFOX.setBtnInteractable("", this.btn_bet, isshow)
        this.btn_bet.getComponent(Button).interactable = isshow

        // xNodeFOX.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFOX.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFOX.setBtnInteractable("", xNodeFOX.find("btn_line", this.node), isshow)
        // xNodeFOX.setBtnInteractable("", xNodeFOX.find("btn_rule", this.node), isshow)
        this.updateBtnAudo();
        if (isshow) this.updateBitView()

        this.updateGoBtnAnim();
    }
    updateBtnAudo() {
        let isAudo = FOXGameManager.getAudoNum() > 0;
        if (isAudo) xNodeFOX.hide("", this.btn_go)
        // if (isAudo) xNodeFOX.hide("", this.btn_auto)
        if (isAudo) xNodeFOX.hide("", this.btn_stop)
        xNodeFOX.setActive("", this.btn_autostop, isAudo)
        xNodeFOX.setBtnInteractable("", this.btn_autostop, isAudo)
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
        let guangAnim: Animation = xNodeFOX.findComponent("mh_vfx_a", this.btn_go, Animation);
        switch (event.type) {
            case "touch-start":
                guangAnim.node.active = true;
                guangAnim.play();
                // this.isAutoShow = true;
                // this.scheduleOnce(this.showSetAudo, 1)
                this.isTouchGo = true;
                break;
            case "touch-move":

                break;
            case "touch-end":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                guangAnim.node.active = false;
                // if (!this.layout_auto.active) {
                this.onGoBtnClick(true)
                // }
                this.isTouchGo = false;
                break;
            case "touch-cancel":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                guangAnim.node.active = false;
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
        if (this.layerCtrl.isReplay || FOXGameManager.getState() !== FOXSTATE.READY || !this.canSendSpin || !this.btn_go.active) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.autoPage ??= new AutoSpinPage(canvas, count => this.onAutoSelectClick(count), () => ({
            balance: showMoney(FOXGlobal.USER.gold),
            bet: showMoney(FOXGameManager.getTotalBitNum(), false),
        }), () => FOXAudioMgr.Instance.playSound('games/menu_icon_press'))).open();
    }

    playWinAni() {
        // let ani: Animation = xNodeFOX.findComponent("winbgani", this.node, Animation);
        // if (isValid(ani)) {
        //     xNodeFOX.show("", ani.node)
        //     ani.play();
        //     this.scheduleOnce(() => { xNodeFOX.hide("", ani.node) }, 0.42)
        // }
    }
    setAwardNum(award: number, rollT = 0) {
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
            xNodeFOX.setLabelRollAni(this.lab_award_num, award, awardbefor, rollT);
        } else {
            this.lab_award_num.string = showMoney(award, false);
        }
    }

    playBigAwardMult10Anim() {
        this.node_win_big.active = true;

        let num_info = xNodeFOX.find("num_info", this.node_win_big);
        num_info.active = true;
        num_info.scale = new Vec3(1, 1);
        tween(num_info).to(0.3, { scale: new Vec3(1.1, 1.1) }).to(0.2, { scale: new Vec3(1, 1) }).start()

        let ib_num_glow_opa: UIOpacity = xNodeFOX.findComponent("ib_num_glow", this.node_win_big, UIOpacity);
        ib_num_glow_opa.node.active = true;
        ib_num_glow_opa.opacity = 255;
        tween(ib_num_glow_opa.node).to(0.3, { scale: new Vec3(1.1, 1.1) }).to(0.2, { scale: new Vec3(1, 1) }).start()
    }
    setBigAwardNum(award, type?, rollT = 0) {
        if (award > 0) {
            this.node_win_big.active = true;
            this.node_win_big.children.forEach((node) => { node.active = false; })

            if (!type) {
                type = FOXGameManager.getWinType(award, FOXGameManager.getTotalBitNum())
            }

            let showBg = xNodeFOX.find(type == 1 ? "ib_bar_a" : "ib_bar_b", this.node_win_big);
            showBg.active = true;
            let ib_bar_opa: UIOpacity = xNodeFOX.findComponent("ib_bar", showBg, UIOpacity);
            ib_bar_opa.opacity = 0;
            tween(ib_bar_opa).to(0.2, { opacity: 255 }).start();

            let ib_back_glow_opa: UIOpacity = xNodeFOX.findComponent("ib_back_glow", showBg, UIOpacity);
            ib_back_glow_opa.opacity = 0;
            tween(ib_back_glow_opa).to(0.3, { opacity: 255 }).to(0.3, { opacity: 0 }).start();

            let ib_coin_ani: Animation = xNodeFOX.findComponent("ib_coin", showBg, Animation);
            ib_coin_ani.play();

            let ib_sweep_ani: Animation = xNodeFOX.findComponent("ib_sweep", showBg, Animation);
            ib_sweep_ani.play();

            let ib_num_glow_opa: UIOpacity = xNodeFOX.findComponent("ib_num_glow", this.node_win_big, UIOpacity);
            ib_num_glow_opa.node.active = true;
            ib_num_glow_opa.opacity = 0;
            tween(ib_num_glow_opa).to(0.3, { opacity: 255 }).delay(0.3).to(0.3, { opacity: 0 }).start();

            let ib_num_particle_ani: Animation = xNodeFOX.findComponent("ib_num_particle", this.node_win_big, Animation);
            ib_num_particle_ani.node.active = true;
            ib_num_particle_ani.play();

            let num_info = xNodeFOX.find("num_info", this.node_win_big);
            if (rollT > 0) {
                xNodeFOX.setLabelRollAni(xNodeFOX.findComponent("num_info", num_info, Label), award, 0, rollT, 0.02, (() => {
                    FOXAudioMgr.Instance.stopLongEffect("games/prizeMedwinMain");
                    FOXAudioMgr.Instance.playSound("games/prizeMedwinEnd");
                }));
            } else {
                xNodeFOX.setLabel("num_info", num_info, showMoney(award));
            }

            num_info.active = true;
            num_info.scale = new Vec3(1, 1);
            tween(num_info).to(0.3, { scale: new Vec3(1.1, 1.1) }).to(0.2, { scale: new Vec3(1, 1) }).start()

        } else {
            this.node_win_big.active = false;
        }

    }

    initTurboBtn() {
        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");
        const fast = foxframe.storage.get("ag7-turbo", false);
        node_off.active = !fast;
        node_on.active = fast;
        FOXGameManager.setFast(fast);
    }

    /**修改速度 */
    onTurboClick() {
        FOXAudioMgr.Instance.playSound("games/menu_icon_press");
        // FOXAudioMgr.Instance.playSound("button/MaxBetButton")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")

        // let spr_fast = this.btn_turbo.getChildByName("spr_fast");
        // spr_fast.active = !spr_fast.active;
        // // xNodeFOX.findComponent("Label", this.btn_turbo, Label).Color = 
        // let lab = this.btn_turbo.getChildByName("Label");
        // lab.getComponent(Label).color = spr_fast.active ? new Color(255, 255, 255, 255) : new Color(94, 94, 94, 255)

        // if (spr_fast.active) {
        //     tween(lab).repeatForever(tween().to(0.5, { scale: new Vec3(1.1, 1.1, 1.1) }).to(0.5, { scale: new Vec3(1, 1, 1) })).start()
        // } else {
        //     Tween.stopAllByTarget(lab);
        //     lab.scale = new Vec3(1, 1, 1);
        // }

        FOXGameManager.setFast(node_on.active);
        foxframe.storage.set("ag7-turbo", node_on.active);
    }

    onAddBtnClick() {
        // FOXAudioMgr.Instance.playSound("button/BetButton");
        if (FOXGlobal.playerType == 0) {
            xNodeFOX.show("qp", this.node);
            this.unschedule(this.hideQipaoPanel);
            this.scheduleOnce(this.hideQipaoPanel, 6);
            return;
        }
        this.updateBitView(FOXGameManager.getTotalBitIndex() + 1, true);
    }

    onSubBtnClick() {
        // FOXAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FOXGameManager.getTotalBitIndex() - 1, true);
    }

    async onGoBtnClick(clicked = false) {
        if (FOXGameManager.getState() !== FOXSTATE.READY || !this.canSendSpin || this.layerCtrl.isReplay) return;
        if (!this.layerCtrl.canAffordSpin()) {
            FOXGameManager.setAudoNum(0);
            this.updateBtnState(true);
            alertGame('余额不足，请充值后再试。');
            return;
        }
        this.canSendSpin = false;
        FOXAudioMgr.Instance.playSound('games/spinBtn');
        FOXAudioMgr.Instance.stopLongEffect('games/bgmBigwinEnd');
        FOXAudioMgr.Instance.stopLongEffect('games/rolling');
        this.setAwardNum(0);
        this.showNorTitle(true);
        FOXGameManager.setWinAllMoneyR(0);
        const stake = this.layerCtrl.stake;
        FOXGameManager.setState(FOXSTATE.RUNING);
        this.layerCtrl.centerRollCtrl.startRotation();
        this.updateBtnState(false);
        if (clicked) this.playStopShow();
        await this.layerCtrl.playPaidSpin(stake);
    }

    onAutoSelectClick(custom) {
        if (custom && this.btn_go.active && this.canSendSpin && !this.layerCtrl.isReplay && FOXGameManager.getState() === FOXSTATE.READY) {
            FOXGameManager.setAudoNum(Number(custom))
            this.checkAudo(false);
            // this.setAutoActive(false);
            this.setBtnMaskActive(false);
        }
    }

    onBtnMaskClick() {
        // let autoNode = xNodeFOX.find("layout_auto", this.node);
        // if (autoNode.active == true) {
        //     autoNode.active = false;
        //     this.setBtnMaskActive(false);
        // } else {
        //     this.setBtnMaskActive(false);
        // }
    }
    onStopAudoRollClick() {
        FOXAudioMgr.Instance.playSound("games/menu_icon_press");
        // FOXAudioMgr.Instance.playSound("button/InfoButton");
        FOXGameManager.setAudoNum(0);
        xNodeFOX.hide("", this.btn_autostop)
        xNodeFOX.setActive("", this.btn_stop, FOXGameManager.getState() != FOXSTATE.READY)
        xNodeFOX.setActive("", this.btn_go, FOXGameManager.getState() == FOXSTATE.READY)
        // xNodeFOX.setActive("", this.btn_auto, FOXGameManager.getState() == FOXSTATE.READY)

        this.updateGoBtnAnim();
    }
    /** Record the stop intent; the reels still wait for a server board. */
    onStopRollClick(bClick = false) {
        if (FOXGameManager.getState() !== FOXSTATE.RUNING || FOXGameManager.getStop()) return;
        if (bClick) FOXAudioMgr.Instance.playSound('games/menu_icon_press');
        FOXGameManager.setStop(true);
        xNodeFOX.find('sb_arrow_blur', this.btn_stop).active = false;
        xNodeFOX.find('sb_arrow_grey', this.btn_stop).active = true;
    }
    // 播放apin按钮按下后，stop按钮动画
    playStopShow() {
        tween(this.btn_stop)
            .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .start()

        xNodeFOX.find("sb_arrow_blur", this.btn_stop).active = true;
        xNodeFOX.find("sb_arrow_grey", this.btn_stop).active = false;

        let starAnim: Animation = xNodeFOX.findComponent("spin_click_star", this.btn_stop, Animation);
        starAnim.node.active = true;
        starAnim.play();

        // this.playSpinFooterAnim();
    }
    onLineBtnClick() {
        // FOXAudioMgr.Instance.playSound("button/InfoButton");
        // if (this.showLineBool) FOXLoadManager.ins.hideLineLayer();
        // else FOXLoadManager.ins.showLineLayerWitnInit(null, this.layerCtrl.lineNode);
        // this.showLineBool = !this.showLineBool
    }

    changeFreeState(isFree: boolean = false) {
        xNodeFOX.setActive("tip_panel", this.node, isFree);
        xNodeFOX.setActive("lab_free", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFOX.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFOX.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFOX.setActive("btn_stop", this.node, !isFree);
        // xNodeFOX.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateFreeNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFOX.setLabel("lab_free", this.node, lab);
    }

    getAwardNumPos() {
        return this.lab_award_num.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    }

    getWinBigPos() {
        return this.node_win_big.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
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
    setAllNum(nums?: number) {
        Tween.stopAllByTarget(this.lab_all_money.node);
        this.curAllMoney = nums ?? FOXGlobal.USER.gold;
        this.lab_all_money.string = this.layerCtrl?.isReplay ? '******' : showMoney(this.curAllMoney);
    }

    rollBalance(amount: number, seconds: number) {
        xNodeFOX.setLabelRollAni(this.lab_all_money, amount, this.curAllMoney, seconds);
        this.curAllMoney = amount;
    }

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
        FOXAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(2);
    }


    onBtnExit() {
        this.layerCtrl.onBtnExit();
    }

    initSoundBtn() {
        xNodeFOX.find("ic_soundon", this.btn_sound).active = foxframe.audio.getSwitchMusic();
        xNodeFOX.find("ic_soundoff", this.btn_sound).active = !foxframe.audio.getSwitchMusic();
    }

    onSoundBtnClick() {
        FOXAudioMgr.Instance.playSound("games/menu_icon_press");
        // FOXAudioMgr.Instance.playSound("button/InfoButton");

        let ic_soundon = xNodeFOX.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeFOX.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        foxframe.audio.setSwitchMusic(ic_soundon.active);
        foxframe.audio.setSwitchEffect(ic_soundon.active);

    }


    onRuleBtnClick() {
        FOXAudioMgr.Instance.playSound('games/menu_icon_press');
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        void (this.rulesPage ??= new RulesPage(canvas)).open();
    }

    onCloseBtnClick() {
        FOXAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(1);
    }

    onALLMoneyClick() {
        if (!this.layerCtrl.isReplay && FOXGameManager.getState() === FOXSTATE.READY) alertGame('余额：' + showMoney(FOXGlobal.USER.gold));
    }

    onBetClick() {
        FOXAudioMgr.Instance.playSound("games/menu_icon_press");
        if (this.layerCtrl.isReplay || FOXGameManager.getState() !== FOXSTATE.READY || !this.canSendSpin) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.betPage ??= new BetOptionsPage(canvas, () => ({
            choices: buildChoices(FOXGameManager.getMultiples().map(String), FOXGameManager.lineCount, FOXGameManager.betLevel),
            bet: String(FOXGameManager.getBitNum()),
            level: FOXGameManager.getBitMultIndex() + 1,
            lines: FOXGameManager.lineCount,
            balance: String(FOXGlobal.USER.gold),
        }), (bet, level) => {
            const index = FOXGameManager.getMultiples().indexOf(Number(bet));
            if (index < 0 || level < 1 || level > FOXGameManager.betLevel) return;
            this.updateBitView(FOXGameManager.getTotalBitIndexBy(index, level - 1));
            // Totals are deduplicated, but retain the base and level the player confirmed.
            FOXGameManager.setBitIndex(index);
            FOXGameManager.setBitMultIndex(level - 1);
        }, () => FOXAudioMgr.Instance.playSound('games/menu_icon_press'))).open();
    }

    onDestroy() {
        this.rulesPage?.close();
        this.betPage?.destroy();
        this.autoPage?.close();
        super.onDestroy();

    }
}

