import { BetOptionsPage } from '../../ui/bet_options_page';
import { buildChoices } from '../../ui/bet_choices';
import { AutoSpinPage } from '../../ui/auto_spin_page';
import { RulesPage } from '../../ui/rules_page';
import { goSession } from '../../net/FDGoSession';
import { alertGame } from '../../net/FDGameUI';
import { _decorator, Component, Node, Button, Label, Toggle, TERRAIN_HEIGHT_BASE, Tween, InstancedBuffer, Sprite, NodeEventType, tween, Color, find, Animation, isValid, sys, UITransform, Vec3, sp, UIOpacity } from 'cc';
import { fdframe } from '../../../fdframe/fdframe';

import { xNodeFD } from '../../../xtools/xNodeFD';
import { FDBaseNode } from '../../base/FDBaseNode';
import { formatStr, recovMoney, showMoney } from '../../common/FDUtils';
import { FDConstant, FDSTATE } from '../../FDConstant/FDConstant';

import FDLoadManager from '../../load/FDLoadManager';
import { FDGameManager } from '../../mgr/FDGameManager';
import { FDGame } from '../scenes/FDGame';
import { FDAudioMgr } from './FDAudioMgr';
import { FDConfigCtrl } from './FDConfigCtrl';
import { FDGameEvent } from './FDGameEvent';
import { FDGameLayerCtrl } from './FDGameLayerCtrl';
import { FDGlobal } from './FDGlobal';
import { FDLanguage } from './FDLanguage';
import FDCenterRollCtrl from './FDCenterRollCtrl';
import { FDSpriteCtrl } from './FDSpriteCtrl';
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
@ccclass('FDOptCtrl')
export class FDOptCtrl extends FDBaseNode {

    ib_bar: Node = null;    // 跑马灯滚动条
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

    layerCtrl: FDGameLayerCtrl = null;

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
            if (FDGameManager.getState() == FDSTATE.READY) {
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
    private get canvas() { return document.getElementById('GameCanvas') as HTMLCanvasElement; }
    private get canConfigure() { return this.canSendSpin && !this.layerCtrl.isReplay && FDGameManager.getState() === FDSTATE.READY; }

    onLoad(): void {

        this.canSendSpin = false;

        this.ib_bar = xNodeFD.find("ib_bar", this.node);
        this.node_win_big = xNodeFD.find("win_bar", this.node);
        // this.ui_footer = xNodeFD.find("ui_footer_a", this.node);
        this.lab_all_money = xNodeFD.findComponent("panel_info/node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeFD.findComponent("panel_info/node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeFD.findComponent("panel_info/node_win/lab", this.node, Label);
        this.btn_all = xNodeFD.find("panel_info/node_all", this.node);
        this.btn_bet = xNodeFD.find("panel_info/node_bet", this.node);

        this.panel1 = xNodeFD.find("panel1", this.node);
        this.panel2 = xNodeFD.find("panel2", this.node);
        this.btn_turbo = xNodeFD.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeFD.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeFD.find("panel1/btn_add", this.node);
        this.btn_auto = xNodeFD.find("panel1/btn_auto_panel", this.node);
        this.btn_go = xNodeFD.find("panel1/btn_go", this.node);
        this.btn_stop = xNodeFD.find("panel1/btn_stop", this.node);
        this.btn_autostop = xNodeFD.find("panel1/btn_autostop", this.node);
        this.tip_panel = xNodeFD.find("tip_panel", this.node);
        this.tip_panel.active = false;
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FDGameLayerCtrl);
        this.btn_mask = xNodeFD.find("btn_mask", this.node)
        this.btn_menu = xNodeFD.find("panel1/btn_menu", this.node);
        this.btn_exit = xNodeFD.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeFD.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeFD.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeFD.find("panel2/btn_close", this.node);

        this.setAwardNum(0)
    }
    initBtnClick() {
        xNodeFD.addClick("", this.btn_all, this.onALLMoneyClick.bind(this));
        xNodeFD.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeFD.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeFD.addTouchStartClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeFD.addTouchStartClick("", this.subBtnNode, this.onSubBtnClick.bind(this));
        xNodeFD.addClick("", this.btn_auto, this.showSetAudo.bind(this));

        xNodeFD.addClick("", this.btn_stop, this.onStopRollClick.bind(this, true));
        xNodeFD.addClick("", this.btn_autostop, this.onStopAudoRollClick.bind(this));
        xNodeFD.addClick("", this.btn_menu, this.onMenuClick.bind(this));
        xNodeFD.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeFD.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeFD.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        xNodeFD.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));
        xNodeFD.addClick('panel2/btn_history', this.node, () => {
            FDAudioMgr.Instance.playSound('menu_icon_press');
            this.layerCtrl.showHistory();
        });

    }


    showNorTitle(bShow, state?) {

        if (bShow) {
            this.ib_bar.active = true;
            let info_main = xNodeFD.find("mask/info_main", this.ib_bar);

            let playInfoMainAnim = () => {
                Tween.stopAllByTarget(info_main);
                let maskW = xNodeFD.find("mask", this.ib_bar).getComponent(UITransform).contentSize.width;
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

            if (state == "free") {
                Tween.stopAllByTarget(this.ib_bar);
                info_main.getComponent(FDSpriteCtrl).setSpriteIndex(4);
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
                                info_main.getComponent(FDSpriteCtrl).setSpriteIndex(showIdx);
                                showIdx = showIdx + 1;
                                if (showIdx == list.length) {
                                    showIdx = 0;
                                }
                                playInfoMainAnim();
                            }).delay(5)
                        )
                        .start()
                    info_main.getComponent(FDSpriteCtrl).setSpriteIndex(showIdx);
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
        this.onTouch()
        this.updateGoBtnAnim();
        this.showNorTitle(true, "init");
        this.initTurboBtn();
        // this.initSoundBtn();
    }

    updateBitView(index: number = FDGameManager.getTotalBitIndex(), bClick = false) {

        let mMultiples: number[] = FDGameManager.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = index >= max;
        let minBool = index <= min;
        index = Math.min(index, max);
        index = Math.max(index, min);
        xNodeFD.setBtnInteractable("", this.addBtnNode, !maxBool);
        xNodeFD.setBtnInteractable("", this.subBtnNode, !minBool);
        if (index !== FDGameManager.getTotalBitIndex()) FDGameManager.setTotalBitIndex(index);
        xNodeFD.setLabel("", this.lab_bit_bottom.node, showMoney(FDGameManager.visualStake ?? FDGameManager.getTotalBitNum()) + "");


        if (bClick) {
            if (index == min) {
                this.showTipPanel("min_bet");
            } else if (index == max) {
                this.showTipPanel("max_bet");
            }
        }
    }

    setStartBit() {
        let gold = FDGlobal.USER.gold;

        let mMultiples: number[] = FDGameManager.getTotalBitList() || [];
        if (!mMultiples || mMultiples.length == 0) {
            return
        }
        let n: number[] = [];;
        for (let i = mMultiples.length - 1; i >= 0; i--) {
            n[i] = Math.abs(mMultiples[i] - gold * 0.01);
        }
        let min = Math.min(...n);
        let minIndex = n.findIndex(item => item == min);
        let localBet: string = (fdframe.storage.get(`${FDConstant.GAMEID}_${FDGlobal.USER.uid}`));
        let localMult: string = (fdframe.storage.get(`${FDConstant.GAMEID}_${FDGlobal.USER.uid}_MULT`)) || 0;

        // localMult = Math.min(localMult, FDGameManager.getMultIndexs().length - 1);

        if (localBet && Number(localBet) < FDGameManager.getMultiples().length - 1) {
            FDGameManager.setBitIndex(Number(localBet));
            FDGameManager.setBitMultIndex(Number(localMult));
            let total = FDGameManager.getTotalBitIndexBy(Number(localBet), Number(localMult));
            FDGameManager.setTotalBitIndex(total);
            this.updateBitView(total);
        }
        else {
            FDGameManager.setTotalBitIndex(minIndex);
            this.updateBitView(minIndex);
        }
    }
    async checkAudo(isEnd: boolean = true) {
  
        xNodeFD.setLabel("lab_autoNum", this.btn_autostop, "" + FDGameManager.getAudoNum())
        xNodeFD.setActive("lab_autoNum", this.btn_autostop, FDGameManager.getAudoNum() > 0)
        if (isEnd && FDGameManager.getAudoNum() > 0) {
            if (this.layerCtrl.canAffordSpin()) {
                this.scheduleOnce(() => {
                    this.onGoBtnClick();
                }, 0)
            } else {
                FDGameManager.setAudoNum(0);
                alertGame("Saldo tidak cukup. Silakan deposit lalu coba lagi.")
                this.updateBtnState(true)
            }
        } else {
            if (!isEnd) {
                this.layerCtrl.sysAutoNum = Math.max(0, FDGameManager.getAudoNum());
            }

            FDGameManager.setAudoNum(0)
            this.updateBtnState(true)
        }
    }
    updateStopBtnInteractable(isinter: boolean) {
        xNodeFD.setBtnInteractable("", this.btn_stop, isinter)
    }

    updateBtnState(isshow: boolean) {
        if (isshow) this.canSendSpin = true;
        xNodeFD.setActive("", this.btn_stop, !isshow)
        xNodeFD.setActive("", this.btn_go, isshow)
        // xNodeFD.setActive("", this.btn_auto, isshow)
        xNodeFD.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeFD.setBtnInteractable("", this.addBtnNode, isshow)
        xNodeFD.setBtnInteractable("", this.btn_auto, isshow)
        xNodeFD.setBtnInteractable("", this.btn_menu, isshow)
        // xNodeFD.setBtnInteractable("", this.btn_bet, isshow)
        this.btn_bet.getComponent(Button).interactable = isshow

        // xNodeFD.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFD.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFD.setBtnInteractable("", xNodeFD.find("btn_line", this.node), isshow)
        // xNodeFD.setBtnInteractable("", xNodeFD.find("btn_rule", this.node), isshow)
        this.updateBtnAudo();
        if (isshow) this.updateBitView()
        // this.layerCtrl.setRealSwitchInteractable(isshow);
        this.updateGoBtnAnim();
    }
    updateBtnAudo() {
        let isAudo = FDGameManager.getAudoNum() > 0;
        if (isAudo) xNodeFD.hide("", this.btn_go)
        // if (isAudo) xNodeFD.hide("", this.btn_auto)
        if (isAudo) xNodeFD.hide("", this.btn_stop)
        xNodeFD.setActive("", this.btn_autostop, isAudo)
        xNodeFD.setBtnInteractable("", this.btn_autostop, isAudo)
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
        // let guangAnim: Animation = xNodeFD.findComponent("mh_vfx_a", this.btn_go, Animation);
        switch (event.type) {
            case "touch-start":
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
        if (!this.canConfigure) return;
        (this.autoPage ??= new AutoSpinPage(this.canvas, count => {
            if (!this.canConfigure) return;
            if (!this.layerCtrl.canAffordSpin()) { alertGame("Saldo tidak cukup. Silakan deposit lalu coba lagi."); return; }
            FDGameManager.setAudoNum(count);
            void this.onGoBtnClick();
        }, () => ({balance:showMoney(FDGlobal.USER.gold),bet:showMoney(FDGameManager.getTotalBitNum())}),
            () => FDAudioMgr.Instance.playSound('menu_icon_press'))).open();
    }

    playWinAni() {
        // let ani: Animation = xNodeFD.findComponent("winbgani", this.node, Animation);
        // if (isValid(ani)) {
        //     xNodeFD.show("", ani.node)
        //     ani.play();
        //     this.scheduleOnce(() => { xNodeFD.hide("", ani.node) }, 0.42)
        // }
    }
    setAwardNum(award: number, rollT = 0) {
        this.showNorTitle(false);

        if (award == 0) {
            this.lab_award_num.string = showMoney(0)
            return
        }
        let awardbefor = recovMoney(this.lab_award_num.string);
        if (awardbefor == award) return;
        let showaward = awardbefor;
        // this.playWinAni();
        Tween.stopAllByTarget(this.lab_award_num.node);
        if (rollT > 0) {
            xNodeFD.setLabelRollAni(this.lab_award_num, award, awardbefor, rollT);
        } else {
            this.lab_award_num.string = showMoney(award, false);
        }
    }

    playBigAwardMult(multCnt) {
        let mult = xNodeFD.find("mult", this.node_win_big);
        mult.active = true
        let mult_opa = mult.getComponent(UIOpacity);
        xNodeFD.setLabel("", mult, "" + multCnt);

        mult.scale = new Vec3(1, 1, 1);
        mult_opa.opacity = 220;
        tween(mult).to(0.5, { scale: new Vec3(2, 2, 2) }).start()
        tween(mult_opa).to(0.5, { opacity: 0 }).start()
    }

    setBigAwardNum(award, type?, rollT = 0, isAll = true) {
        if (award > 0) {
            this.node_win_big.active = true;

            this.node_win_big.children.forEach((node) => {
                if (node.name !== "mult")
                    node.active = false;
            })
            if (!type) {
                type = FDGameManager.getWinType(award, FDGameManager.getTotalBitNum())
            }

            let showBg: Node;
            if (type == 1) {
                showBg = xNodeFD.find("ib_bar_a", this.node_win_big);
            } else if (type == 2) {
                showBg = xNodeFD.find("ib_bar_b", this.node_win_big);
            } else {
                showBg = xNodeFD.find("ib_bar_c", this.node_win_big);
                let ib_vfx_f_mw_normal = xNodeFD.find("ib_vfx_f_mw_normal", this.node_win_big);
                ib_vfx_f_mw_normal.active = true;
                ib_vfx_f_mw_normal.getComponent(Animation).play();
            }

            showBg.active = true;
            showBg.getComponent(Animation).play();

            let ib_vfx_d_screen = xNodeFD.find("ib_vfx_d_screen", this.node_win_big);
            ib_vfx_d_screen.active = true;
            ib_vfx_d_screen.getComponent(Animation).play();
            let ib_vfx_c_add = xNodeFD.find("ib_vfx_c_add", this.node_win_big);
            ib_vfx_c_add.active = true;
            ib_vfx_c_add.getComponent(Animation).play();
            let ib_vfx_b_screen = xNodeFD.find("ib_vfx_b_screen", this.node_win_big);
            ib_vfx_b_screen.active = true;
            ib_vfx_b_screen.getComponent(Animation).play();

            let num_info = xNodeFD.find("num_info", this.node_win_big);
            if (rollT > 0) {
                xNodeFD.setLabelRollAni(xNodeFD.findComponent("num_info", num_info, Label), award, 0, rollT, 0.02);
            } else {
                xNodeFD.setLabel("num_info", num_info, showMoney(award));
            }

            xNodeFD.find("info_win", num_info).getComponent(FDSpriteCtrl).sprIndex = isAll ? 1 : 0;

            num_info.active = true;
            num_info.scale = new Vec3(1, 1, 1);
            tween(num_info).to(0.3, { scale: new Vec3(1.1, 1.1, 1) }).to(0.2, { scale: new Vec3(1, 1, 1) }).start()

        } else {
            this.node_win_big.active = false;
        }

    }

    initTurboBtn() {
        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");
        node_off.active = true;
        node_on.active = false;
        FDGameManager.setFast(false);
    }

    /**修改速度 */
    onTurboClick() {
        FDAudioMgr.Instance.playSound("menu_icon_press");
        // FDAudioMgr.Instance.playSound("button/MaxBetButton")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")


        FDGameManager.setFast(node_on.active)
    }

    onAddBtnClick() {
        // FDAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FDGameManager.getTotalBitIndex() + 1, true);
    }

    onSubBtnClick() {
        // FDAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FDGameManager.getTotalBitIndex() - 1, true);
    }

    async onGoBtnClick(clicked = false) {
        if (!this.canConfigure) return;
        if (!this.layerCtrl.canAffordSpin()) { alertGame("Saldo tidak cukup. Silakan deposit lalu coba lagi."); return; }
        const stake = this.layerCtrl.stake;
        this.canSendSpin = false;
        if (clicked) FDAudioMgr.Instance.playSound('spinBtn');
        this.setAwardNum(0);
        this.showNorTitle(true);
        FDGameManager.setWinAllMoneyR(0);
        FDGameManager.setState(FDSTATE.RUNING);
        this.layerCtrl.centerRollCtrl.startRotation();
        this.updateBtnState(false);
        this.playStopShow();
        await this.layerCtrl.playPaidSpin(stake);
    }

    onBtnMaskClick() {
 
    }
    onStopAudoRollClick() {
        FDAudioMgr.Instance.playSound("menu_icon_press");
        // FDAudioMgr.Instance.playSound("button/InfoButton");
        FDGameManager.setAudoNum(0);
        xNodeFD.hide("", this.btn_autostop)
        xNodeFD.setActive("", this.btn_stop, FDGameManager.getState() != FDSTATE.READY)
        xNodeFD.setActive("", this.btn_go, FDGameManager.getState() == FDSTATE.READY)
        // xNodeFD.setActive("", this.btn_auto, FDGameManager.getState() == FDSTATE.READY)

        this.updateGoBtnAnim();
    }
    /**手动停止滚动/停止自动滚动 */
    onStopRollClick(bClick = false) {
        if (FDGameManager.getStop() || (bClick && FDGameManager.getState() !== FDSTATE.RUNING)) return
        if (bClick)
            FDAudioMgr.Instance.playSound("menu_icon_press");
        FDGameManager.setStop(true);

        xNodeFD.find("sb_arrow_blur", this.btn_stop).active = false;
        xNodeFD.find("sb_arrow_grey", this.btn_stop).active = true;
    }
    // 播放apin按钮按下后，stop按钮动画
    playStopShow() {

        this.btn_stop.getComponent(Animation).play()

        xNodeFD.find("sb_arrow_blur", this.btn_stop).active = true;
        xNodeFD.find("sb_arrow_grey", this.btn_stop).active = false;


    }
    onLineBtnClick() {
   
    }

    changeFreeState(isFree: boolean = false) {
        xNodeFD.setActive("tip_panel", this.node, isFree);
        xNodeFD.setActive("lab_free", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFD.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFD.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFD.setActive("btn_stop", this.node, !isFree);
        // xNodeFD.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateFreeNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFD.setLabel("lab_free", this.node, lab);
    }

    getAwardNumPos() {
        return this.lab_award_num.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    }

    updateGoBtnAnim() {
   
    }



    // 刷新总钱
    setAllNum(nums = FDGlobal.USER.gold) {
        Tween.stopAllByTarget(this.lab_all_money.node);
        this.curAllMoney = nums;
        this.lab_all_money.string = this.layerCtrl.isReplay ? '******' : showMoney(nums);
    }

    rollBalance(nums: number, _seconds: number) { this.setAllNum(nums); }

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



    onBtnExit() {
        FDAudioMgr.Instance.playSound("menu_icon_press");
        this.layerCtrl.onBtnExit();
    }

    onMenuClick() {
        FDAudioMgr.Instance.playSound("menu_icon_press");
        this.changePanel(2);
    }

    changePanel(id) {

        let changeT = 0.08;
        if (id == 1) {
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
    initSoundBtn() {
        xNodeFD.find("ic_soundon", this.btn_sound).active = fdframe.audio.getSwitchMusic();
        xNodeFD.find("ic_soundoff", this.btn_sound).active = !fdframe.audio.getSwitchMusic();
    }

    onSoundBtnClick() {
        FDAudioMgr.Instance.playSound("menu_icon_press");
        // WOQAudioMgr.Instance.playSound("button/InfoButton");

        let ic_soundon = xNodeFD.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeFD.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        fdframe.audio.setSwitchMusic(ic_soundon.active);
        fdframe.audio.setSwitchEffect(ic_soundon.active);

    }
    onRuleBtnClick() {
        FDAudioMgr.Instance.playSound("menu_icon_press");
        void (this.rulesPage ??= new RulesPage(this.canvas)).open();
    }

    onCloseBtnClick() {
        FDAudioMgr.Instance.playSound("menu_icon_press");
        this.changePanel(1);
    }
  
    onALLMoneyClick() {
        if (!this.canConfigure) return;
        alertGame("Saldo dompet: " + showMoney(FDGlobal.USER.gold));
    }

    onBetClick() {
        if (!this.canConfigure) return;
        (this.betPage ??= new BetOptionsPage(this.canvas, () => {
            const {policy} = goSession.entry;
            return {choices:buildChoices(policy.betOptions,policy.lineCount,policy.betLevel), bet:String(FDGameManager.getBitNum()),
                level:FDGameManager.getBitMultIndex()+1, lines:policy.lineCount, balance:String(FDGlobal.USER.gold),
                multiplier:FDGameManager.getAntMult()};
        }, (bet,level) => {
            if (!this.canConfigure) return;
            const index = goSession.entry.policy.betOptions.indexOf(bet);
            if (index < 0) return;
            FDGameManager.setBitIndex(index);
            FDGameManager.setBitMultIndex(level-1);
            FDGameManager.setTotalBitIndex(FDGameManager.getTotalBitIndexBy());
            this.updateBitView();
        }, () => FDAudioMgr.Instance.playSound('menu_icon_press'))).open();
    }

    setBgIsFree(isFree) {
        this.panel1.active = !isFree;
        xNodeFD.find("panel_free", this.node).active = isFree;
    }

    updateFreeCnt(cnt) {
        xNodeFD.find("panel_free/free_spins_remaining", this.node).active = cnt > 0;
        xNodeFD.find("panel_free/last_free_spin", this.node).active = cnt == 0;
        if (cnt > 0) {
            xNodeFD.setLabel("panel_free/free_spins_remaining/fnt_1", this.node, cnt);
        }
    }


    onDestroy() {
        this.autoPage?.destroy();
        this.betPage?.destroy();
        this.rulesPage?.close();
        super.onDestroy();

    }
}

