import { _decorator, instantiate, Vec3, tween, find, sp, Label, Node, UIOpacity, UITransform, Sprite, Color, isValid, Prefab, Tween, ParticleSystem2D, bezier, NodeEventType, Animation, math, view, Vec2, } from 'cc';
import { fmframe } from '../../../fmframe/fmframe';
import { xNodeFM } from '../../../xtools/xNodeFM';
import { Frame } from '../../net/FMResultAdapter';
import { FMBaseNode } from '../../base/FMBaseNode';
import { __, longToNumber, showMoney } from '../../common/FMUtils';

import { FMConstant, FMSTATE, WINTYPE } from '../../FMConstant/FMConstant';
import FMLoadManager from '../../load/FMLoadManager';
import { FMGameManager, IgetCanStop } from '../../mgr/FMGameManager';
import { FMAudioMgr } from './FMAudioMgr';
import { FMCellItem } from './FMCellItem';
import { FMConfigCtrl } from './FMConfigCtrl';
import { FMGameLayerCtrl } from './FMGameLayerCtrl';
import { FMGlobal } from './FMGlobal';

// import FMPopupCtrl from './FMPopupCtrl';
// import { FMTransitionCtrl } from './FMTransitionCtrl';
import { FMCellLayer } from './FMCellLayer';
import { FMBigWinCtrl } from './FMBigWinCtrl';
import { FMSpriteCtrl } from './FMSpriteCtrl';

const { ccclass } = _decorator;

@ccclass('FMCenterRollCtrl')
export default class FMCenterRollCtrl extends FMBaseNode {

    private frame?: Frame;
    private rotatingOuter = false;
    private cellLayerCtrlList: FMCellLayer[] = [];

    layerCtrl: FMGameLayerCtrl = null;
    // popupCtrl: FMPopupCtrl = null;
    // transCtrl: FMTransitionCtrl = null;

    _startMove: boolean = false;// 是否开始旋转
    _canStop: boolean = false;// 可以停止
    _bStop: boolean = false;    // 是否已经开始停止
    _stopLayerCnt: number = 0;  //停止旋转的列个数--5列都停了才开始处理停止操作
    _startLayerCnt: number = 0; // 开始旋转的列个数--要等到5列都开始转才能停止
    _minIdleT: number = 0;  // 开始转动的额外空转时间

    _canCLickMultPanel = false; // 是否可以点击图标
    _avatarSp: sp.Skeleton = null;
    // _hasPlayWildStop = false;

    _roofLookIdx: number = 0;  // 老鼠转头音效idx

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FMGameLayerCtrl);
        this._avatarSp = find("Canvas/GameLayer/avatar").getComponent(sp.Skeleton);
        this.playAvatarIdleAnim();
        this.setAvatarNormalPos(true);
        this.showNormalBg(true);

        this.node.getChildByName("node_mult").on(NodeEventType.TOUCH_END, this.clickMultPanel, this);
        this._canCLickMultPanel = true;
    }
    initLanguageView() {
    }
    start() {
        this.initAttribute();
        this.initLanguageView();
        this.creatRollItem();
    }

    private creatRollItem(index: number = null) {
        let nodeList = this.node.getChildByName("node_item_list");
        for (let index = 0; index < nodeList.children.length; index++) {
            let pNode = nodeList.children[index];
            let cellLayerCtrl = pNode.addComponent(FMCellLayer);
            cellLayerCtrl.init(index, this);
            cellLayerCtrl.creatOne();
            this.cellLayerCtrlList.push(cellLayerCtrl);
        }
    }

    resData() {
        this._startMove = false;
        this._canStop = true;
        this._bStop = false;
        this._stopLayerCnt = 0;
        this._startLayerCnt = 0;
        this._minIdleT = 0;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.resData();
        })
        // this._hasPlayWildStop = false;
    }

    // 初始化所有节点，即中线动画全部隐藏、top层的全部隐藏、卷轴层的全部显示为默认,且不置灰、
    initLight() {
        // FMAudioMgr.Instance.stopSound();
        this.unscheduleAllCallbacks();
        this.hideAllLineMoney();
        this.hideAllLine();
        this.hideAllKuang();
        this.hideAllCellTop();
        this.showSlotsGray(FMGameManager.isHaveBonus());
        // this.cellLayerCtrlList.forEach(layerCtrl => {
        //     layerCtrl.allCellList.forEach(node => {
        //         node.active = true;
        //     })
        // })
    }

    /**开始转动 */
    public startRotation() {
        fmframe.log.logView("startRotation");
        if (this._startMove) return
        this.unscheduleAllCallbacks();
        if (!FMAudioMgr.Instance.isMusicPlaying()) {
            FMAudioMgr.Instance.playMusic();
        }
        this._canCLickMultPanel = false;

        this.unschedule(this.hideOneMult);
        this.hideOneMult();

        FMGameManager.setStop(false);
        this.frame = undefined;
        this.rotatingOuter = false;
        FMGameManager.specialSpin = false;
        FMGameManager.setRotateData(null);
        FMGameManager.setRoundTime(0);
        this.resData();
        this._canStop = false;
        this.initLight();
        this.playStartSpinAnim();
        this.showNormalBg(true);

        FMGameManager.setRollLayerCnt(this.cellLayerCtrlList.length);
        this._startMove = true;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.setStartMove();
        })


    }

    playStartSpinAnim() {
        let guang = xNodeFM.find("bg/start_spin_guang", this.node);
        if (!guang) {
            guang = instantiate(FMLoadManager.ins.getPrefab("res/load/prefab/games/start_spin_guang"));
            guang.parent = xNodeFM.find("bg", this.node);
        }
        guang.active = true;
        guang.getComponent(Animation).play();

        let par = xNodeFM.find("panel/start_spin_par", this.node);
        par.active = true;
        par.getComponent(ParticleSystem2D).resetSystem();

    }

    // 开始旋转--回弹结束
    playStartRoll(index) {
        this._startLayerCnt += 1;

        if (FMGameManager.getFastAndNoFree()) {
            this._minIdleT += 0.13;
        } else {
            this._minIdleT += 0.3;
        }

        FMAudioMgr.Instance.playSound("games/spin_active_loop");


    }

    // 准备停止
    playReadyToStop(index) {
        if (FMGameManager.isSpecialGame()) {
            if (index == 0) {
                this.playTurnEffect();
            }
        }
    }

    // 开始滚动回弹
    playBackRoll(index) {
        if (FMGameManager.isSpecialGame()) {
            if (index == 0) {
                this.playAvatarAnim("turnR");
            } else if (index == 2) {
                this.playTurnEffect();
            }
        }

    }

    // 停止转动
    playStopRoll(index) {
        this._stopLayerCnt += 1;
        if (this._stopLayerCnt == 1) {
            FMAudioMgr.Instance.stopLongEffect("games/fs_reel_loop");
        }
        if (this._stopLayerCnt == FMGameManager.getRollLayerCnt()) {

            void this.oneRoundEnd().catch(error => this.layerCtrl.handleAnimationError(error));
        }
        // this.hideTriFreeGuang();
    }

    acceptFrame(frame: Frame) {
        this.frame = frame;
        FMGameManager.specialSpin = frame.gameData.special;
        if (frame.gameData.special && !this.rotatingOuter) {
            void this.triFreeGameAnim().catch(error => this.layerCtrl.handleAnimationError(error));
        } else if (!frame.gameData.special && Math.random() < 0.05) {
            void this.triFreeGameFailAnim().catch(error => this.layerCtrl.handleAnimationError(error));
        } else {
            this._canStop = true;
        }
    }

    showStoredBoard(icons: number[]) {
        this.initLight();
        this.setStoredSymbols(icons);
    }

    private setStoredSymbols(icons: number[]) {
        this.cellLayerCtrlList.forEach((layer, col) =>
            layer.showStoredSymbols(icons.filter((_, idx) => idx % FMConstant.COL_COUNT === col)));
    }

    cancelRoll(icons: number[]) {
        this.frame = undefined;
        this.rotatingOuter = false;
        FMGameManager.specialSpin = false;
        this.resData();
        Tween.stopAllByTarget(this.node);
        this.node.setScale(1, 1, 1);
        this.playSpecialDecAnim(false, false, 0);
        this.showNormalBg(true);
        xNodeFM.find('panel/respin_utw', this.node).active = false;
        xNodeFM.find('node_respin_wild', this.node).children.forEach(node => node.active = false);
        this.setAvatarNormalPos(true);
        this.playAvatarIdleAnim();
        FMAudioMgr.Instance.stopLongEffect('games/fs_reel_loop');
        FMAudioMgr.Instance.stopMusic();
        FMAudioMgr.Instance.playMusic();
        this.showStoredBoard(icons);
    }

    restoreSpecial() {
        FMGameManager.specialSpin = true;
        this.node.setScale(0.9, 0.9, 1);
        this.playSpecialDecAnim(true, false, 0);
        this.showNormalBg(false);
        this.setAvatarNormalPos(false);
        this._avatarSp.setAnimation(0, 'top_excite_lookL', true);
        this.layerCtrl.optCtrl.showNorTitle(true, 'triFree');
        const banner = xNodeFM.find('panel/respin_utw', this.node);
        banner.setScale(1, 1, 1);
        banner.active = true;
        this.cellLayerCtrlList[1].showStoredSymbols([7, 7, 7]);
        FMAudioMgr.Instance.stopMusic();
        FMAudioMgr.Instance.playMusic('bgm_respin');
    }

    startSpecialRotation() {
        this.frame = undefined;
        this.rotatingOuter = true;
        FMGameManager.specialSpin = true;
        FMGameManager.setRotateData(null);
        FMGameManager.setRoundTime(0);
        this.resData();
        this.cellLayerCtrlList[1].showStoredSymbols([7, 7, 7]);
        FMGameManager.setRollLayerCnt(2);
        this._canStop = false;
        this._startMove = true;
        this.cellLayerCtrlList[0].setStartMove();
        this.cellLayerCtrlList[2].setStartMove();
        this.playAvatarAnim('turnL');
        this.playStartSpinAnim();
        FMAudioMgr.Instance.playSound('games/fsReelActive');
        FMAudioMgr.Instance.playLongEffect('games/fs_reel_loop');
    }

    async oneRoundEnd() {
        const frame = this.frame;
        const rotate = FMGameManager.getRotateData(true);
        if (!frame || !rotate) return;
        const {mIcons, mAwardList} = rotate;
        if (frame.gameData.special) {
            // Reset recycled cells and cancel the outgoing rebound before the next respin.
            this.setStoredSymbols(mIcons);
            if (frame.nextAction === 'continue') {
                await this.delayTime(0.3);
                await this.layerCtrl.continuePlay(frame);
                return;
            }
            this.playAvatarAnim('win_special');
        } else {
            await this.playWildFlyAnim(mIcons);
        }
        if (mAwardList.length) {
            this.showSlotsGray(true);
            this.showWinTrace(mAwardList, mAwardList.length);
            await this.showBottomWin(mAwardList, mIcons, frame.gameData.special);
        }
        if (frame.gameData.special) {
            this.playAvatarAnim('endSpecial');
            await this.delayTime(1.2);
            this.recoverToNormal();
            this.showNormalBg(true);
            xNodeFM.find('node_respin_wild', this.node).children.forEach(node => node.active = false);
            FMAudioMgr.Instance.stopMusic();
            FMAudioMgr.Instance.playMusic();
            await this.delayTime(0.5);
        } else if (FMGameManager.getAudoNum() > 0) {
            await this.delayTime(0.3);
        }
        this.roundEnd();
    }

    showWinTrace(awardList, index, bSpecial?) {

        let playLine = (awardData, bShowMoney) => {
            let mIconIdxs = awardData.mIconIdxs;
            let money = longToNumber(awardData.mMoney);
            let flag_id = awardData.flag_id;

            for (let i = 0; i < mIconIdxs.length; i++) {
                let idx = mIconIdxs[i] - 1;
                let cell = this.getCellByIdx(idx);
                let type = cell.getComponent(FMCellItem).type;
                let cellTop = this.playCellToTop(idx, type);
                cellTop.active = true;
                cellTop.getComponent(FMCellItem).playWinAni(false);
                this.playKuang(idx);
            }

            if (flag_id > 0) {
                this.playOneLine(flag_id - 1);
                if (bShowMoney) this.playOneLineMoney(flag_id - 1, money);
            }

            FMAudioMgr.Instance.playSound("games/prizePayoutIdle");
        }

        if (awardList) {
            this.hideAllLineMoney();
            this.hideAllLine();
            this.hideAllKuang();
            this.hideAllCellTop();
            if (index == awardList.length) {  // 总的
                for (let i = 0; i < awardList.length; i++) {
                    playLine(awardList[i], false);
                }
                this.scheduleOnce(() => this.showWinTrace(awardList, 0), 1.5);
            } else {    // 单的
                playLine(awardList[index], true);
                this.scheduleOnce(() => this.showWinTrace(awardList, index + 1), 1.5);
            }
        }

    }

    async showBottomWin(awardList, mIcon, bSpecial = false) {
        let roundWinMoney: number = 0;
        let hasFcracker = false;
        if (!hasFcracker) {
            for (let i = 0; i < awardList.length; i++) {
                for (let j = 0; j < awardList[i].mIconIdxs.length; j++) {
                    if (mIcon[awardList[i].mIconIdxs[j] - 1] == FMConstant.FCRACKER_TYPE) {
                        hasFcracker = true;
                    }
                }
            }
        }

        awardList.forEach(arardInfo => {
            roundWinMoney += longToNumber(arardInfo.mMoney);
        })

        let totalWin = roundWinMoney;

        let bitNum = FMGameManager.visualStake ?? FMGameManager.getTotalBitNum()
        let bigWinType = FMGameManager.getBigWinType(roundWinMoney, bitNum);
        if (bigWinType) {
            // await this.checkBigWin(roundWinMoney);

            await new Promise<void>((resolve, reject) => {
                let node = xNodeFM.find("node_ani/big_win", this.layerCtrl.node);
                if (!node) {
                    let prefab = FMLoadManager.ins.getPrefab("res/load/prefab/games/big_win");
                    node = instantiate(prefab);
                    node.parent = xNodeFM.find("node_ani", this.layerCtrl.node);
                }
                node.getComponent(FMBigWinCtrl).playBigWin(roundWinMoney, bigWinType, resolve);
            })
        } else {
            FMAudioMgr.Instance.playSound("games/prizeSmallwin")

            if (bSpecial) {
                // this.playAvatarAnim("win_special");
            } else {

                let effList = [];
                if (hasFcracker) {
                    effList = ["voxMedwin01", "voxMedwin02", "voxMedwin03"];

                } else {
                    effList = ["voxSmallwin01", "voxSmallwin02", "voxSmallwin03"];
                }
                FMAudioMgr.Instance.playSound("games/" + effList[Math.floor(Math.random() * effList.length)])
                this.playAvatarAnim(hasFcracker ? "medium_win" : "small_win");
            }
        }


        FMGameManager.setWinMoney(totalWin);
        this.layerCtrl.optCtrl.showNorTitle(false);
        this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5, !bSpecial && hasFcracker);

    }

    // /**
    //  * 检查播放bigwin
    //  * @param coin 赢钱
    //  * @param bitNum 总压注
    //  * @param noDelayT 不播bigwin的延迟时常
    //  * @returns 
    //  */
    // checkBigWin(coin: number, noDelayT: number = 0) {
    //     return new Promise<void>(async (resolve, reject) => {
    //         let bitNum = FMGameManager.visualStake ?? FMGameManager.getTotalBitNum()
    //         let bigWinType = FMGameManager.getBigWinType(coin, bitNum);
    //         if (!bigWinType) {
    //             this.scheduleOnce(() => { resolve() }, noDelayT)
    //             return
    //         }

    //         let endFunc = () => {
    //             resolve();
    //         }
    //         await this.delayTime(0.5);
    //         let node = xNodeFM.find("node_ani/big_win", this.layerCtrl.node);
    //         if (!node) {
    //             let prefab = FMLoadManager.ins.getPrefab("res/load/prefab/games/big_win");
    //             node = instantiate(prefab);
    //             node.parent = xNodeFM.find("node_ani", this.layerCtrl.node);
    //         }
    //         node.getComponent(FMBigWinCtrl).playBigWin(coin, bigWinType, endFunc);
    //     })
    // }


    playWildFlyAnim(mIcons) {
        return new Promise<void>(async (resolve, reject) => {
            let hasPlay = false, playFlyEff = false, playFly = false;
            // let node_wildFly = this.node.getChildByName("node_wildFly");
            let parentNode = this.layerCtrl.node;

            // let playList = [6, 3, 0, 7, 4, 1, 8, 5, 2];
            for (let i = 0; i < FMConstant.COL_COUNT * FMConstant.ROW_COUNT; i++) {
                if (mIcons[i] == FMConstant.WILD_TYPE) {
                    if (!hasPlay) {
                        FMAudioMgr.Instance.playSound("games/prizeSymWild");
                        hasPlay = true;
                    }

                    let cellTop = this.playCellToTop(i, mIcons[i]);
                    cellTop.active = true;
                    cellTop.getComponent(FMCellItem).playSpawnAnim();

                    let wild_fly = FMLoadManager.ins.showGetPrefab("res/load/prefab/games/wild_fly", parentNode);
                    wild_fly.active = true;
                    wild_fly.position = parentNode.getComponent(UITransform).convertToNodeSpaceAR(cellTop.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
                    let par = wild_fly.getChildByName("par");
                    par.position = new Vec3(0, 0, 0);

                    let ePos = wild_fly.getComponent(UITransform).convertToNodeSpaceAR(this.getHBWPos());
                    tween(par)
                        .delay(0.1)
                        .call(() => {
                            if (!playFlyEff) {
                                FMAudioMgr.Instance.playSound("games/prizeSymWildCollect");
                                playFlyEff = true;
                            }
                        })
                        .to(0.35, { position: ePos })
                        .call(() => {
                            wild_fly.destroy();
                            if (!playFly) {
                                FMAudioMgr.Instance.playSound("games/voxWildCollect0" + Math.ceil(Math.random() * 3));
                                playFly = true;

                                this.playAvatarAnim("wildCollect")
                            }
                        })
                        .start()
                }
            }

            if (hasPlay) {
                await this.delayTime(1.1)
            }
            resolve();
        })

    }


    /**
     * 节点播放动画时提到上层
     * @param index 0开始
     */
    playCellToTop(index, type) {
        let node_top = this.node.getChildByName("node_top");
        let cell = xNodeFM.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FMLoadManager.ins.getPrefab(FMConstant.PRAFAB_CELL_WIN));
            cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(index));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FMCellItem).initTypeView(type);
        }
        if (cell.getComponent(FMCellItem).type !== type) {
            cell.getComponent(FMCellItem).setTypeView(type);
        }

        return cell
    }
    copyCellToTop(ori_cell) {
        let node_top = this.node.getChildByName("node_top");
        let type = ori_cell.getComponent(FMCellItem).type;
        let index = ori_cell.getComponent(FMCellItem).index;
        let cell = xNodeFM.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FMLoadManager.ins.getPrefab(FMConstant.PRAFAB_CELL_WIN));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FMCellItem).initTypeView(type);
        }
        cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(ori_cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        cell.active = true;
        cell.getComponent(FMCellItem).setTypeView(type);
        return cell
    }
    hideAllCellTop() {
        let node_top = this.node.getChildByName("node_top");
        if (node_top) {
            node_top.children.forEach(node => {
                node.children.forEach(node2 => {
                    node2.active = false;
                })
                node.active = false;
            })
        }
    }

    sortChildToParent(parentNode, childNode, str) {
        let insertIndex = -1;
        let addNum = parseInt(childNode.name.slice(str.length));
        for (let i = 0; i < parentNode.children.length; i++) {
            if (parentNode.children[i].name.startsWith(str)) {
                let curNum = parseInt(parentNode.children[i].name.slice(str.length))
                if (addNum > curNum) {
                    insertIndex = i;
                    break;
                }
            }
        }

        if (insertIndex === -1) {
            parentNode.addChild(childNode);
        } else {// 插入新节点到指定位置
            parentNode.insertChild(childNode, insertIndex);
        }
    }


    showSlotsGray(bShow) {
        let node = xNodeFM.find("mask", this.node);
        node && (node.active = bShow);
    }


    // 中线-线动画 flag_id--0开始
    playOneLine(flag_id: number) {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            let line = xNodeFM.find(`line${flag_id}`, node_line);
            if (!line) {
                line = instantiate(FMLoadManager.ins.getPrefab("res/load/prefab/games/win_payline"));
                node_line.addChild(line);
                line.position = new Vec3(0, [6, 209, -197, 6, 6][flag_id], 0);
                line.eulerAngles = new Vec3(0, 0, [0, 0, 0, -39, 39][flag_id]);
                line.scale = new Vec3(flag_id < 3 ? 1.4 : 1.85, 1.4, 0);
                line.children.forEach((node) => {
                    node.scale = new Vec3(flag_id < 3 ? 0.6 : 1.5, 1, 0);
                })
                line.name = `line${flag_id}`;
            }
            line.active = true;
            line.children.forEach((node) => {
                node.getComponent(Animation).play();
            })
        }
        let num_line = xNodeFM.find("panel/payline_num/win", this.node);
        if (num_line) {
            num_line.getChildByName("payline_block_" + (flag_id + 1) + "_l").active = true;
            num_line.getChildByName("payline_block_" + (flag_id + 1) + "_r").active = true;
            num_line.getChildByName((flag_id + 1) + "_l").active = true;
            num_line.getChildByName((flag_id + 1) + "_r").active = true;
        }
    }
    hideAllLine() {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            node_line.children.forEach(node => {
                node.active = false;
            })
        }
        let num_line = xNodeFM.find("panel/payline_num/win", this.node);
        if (num_line) {
            num_line.children.forEach(node => {
                node.active = false;
            })
        }
    }

    //中线赢分 flag_id--0开始
    playOneLineMoney(flag_id: number, money: number) {
        let node_money = this.node.getChildByName("node_money");
        let mask = node_money.getChildByName(`mask_${flag_id > 2 ? 0 : flag_id}`);
        mask.active = true;
        xNodeFM.setLabel("num_info", mask, showMoney(money));
    }
    hideAllLineMoney() {
        let node_money = this.node.getChildByName("node_money");
        node_money.children.forEach(node => node.active = false);
    }

    /**
     * 中线框动画
     * @param idx 0开始
     */
    playKuang(idx: number) {
        let node_kuang = this.node.getChildByName("node_kuang");
        if (node_kuang) {
            let kuang = xNodeFM.find(`kuang${idx}`, node_kuang);
            if (!kuang) {
                kuang = instantiate(FMLoadManager.ins.getPrefab("res/load/prefab/games/win_kuang"));
                node_kuang.addChild(kuang);
                kuang.position = new Vec3([-242, 0, 242][idx % FMConstant.ROW_COUNT], [-197, 6, 209][Math.floor(idx / FMConstant.COL_COUNT)], 0);
                kuang.name = `kuang${idx}`;
            }
            kuang.active = true;

            kuang.getComponent(Animation).play();
        }
    }
    hideAllKuang() {
        let node_kuang = this.node.getChildByName("node_kuang");
        if (node_kuang) {
            node_kuang.children.forEach(node => {
                node.active = false;
            })
        }
    }

    showCellMult() {


    }

    getHBWPos() {
        return xNodeFM.find("pos_yb", this._avatarSp.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0))
    }

    /**
     * 
     * @param idx 0开始
     */
    getWorldPosByIdx(idx: number): Vec3 {
        let col = idx % FMConstant.COL_COUNT;
        let row = Math.floor(idx / FMConstant.COL_COUNT);

        let y = FMConstant.CELL_SIZE.height * (row + 1 / 2);
        let pos = this.cellLayerCtrlList[col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return pos
    }

    // idx 0开始
    getCellByIdx(idx: number) {
        let col = idx % FMConstant.COL_COUNT;
        let row = Math.floor(idx / FMConstant.COL_COUNT);
        let node = this.cellLayerCtrlList[col].resultCell[row];
        return node;
    }





    clickMultPanel(event) {
        if (!this._canCLickMultPanel) {
            return
        }
        let node = event.target;

        let wPos = event.getUILocation();
        let clickPos = node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(wPos.x, wPos.y, 0));
        let col, row;
        let posX, posY;
        if (clickPos.x < -117.5) {
            col = 0;
        } else if (clickPos.x < 117.5) {
            col = 1;
        } else {
            col = 2;
        }
        if (clickPos.y < -101.5) {
            row = 0;
        } else if (clickPos.y < 101.5) {
            row = 1;
        } else {
            row = 2;
        }

        let cell_ref = FMConstant.CELL_SIZE.weight / 2 + 2
        let cellIdx = row * 3 + col;
        let cell = this.getCellByIdx(cellIdx);
        let type = cell.getComponent(FMCellItem).type;
        let refPos = node.getComponent(UITransform).convertToNodeSpaceAR(cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        posX = col > 1 ? refPos.x - cell_ref : refPos.x + cell_ref;
        posY = refPos.y;

        if (type == 0) {
            return
        }

        let panel = node.getChildByName("mult_panel");
        if (panel && panel.active) {
            panel.active = false;
        }
        if (!panel) {
            panel = instantiate(FMLoadManager.ins.getPrefab("res/load/prefab/games/mult_panel"));
            node.addChild(panel);
            panel.name = "mult_panel";
            panel.on("click", this.onClickMultPanel, this);
        }

        FMAudioMgr.Instance.playSound("games/uiPayout");
        xNodeFM.find("node_mult/SpriteSplash", this.node).active = true;
        panel.active = true;
        panel.position = new Vec3(posX, posY, 0)
        let ui_paytable = panel.getChildByName("ui_paytable");
        let num_cnt = panel.getChildByName("num_cnt");
        let num_mult = panel.getChildByName("num_mult");
        let cell_win = panel.getChildByName("cell_win");
        ui_paytable.scale = new Vec3(col > 1 ? -1 : 1, 1, 1);
        xNodeFM.setLabel("", num_cnt, "3");
        xNodeFM.setLabel("", num_mult, FMConstant.PRAFAB_LIST[type].MULT);
        cell_win.children.forEach(node => node.active = false);
        let showSp: sp.Skeleton = xNodeFM.findComponent(FMConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
        showSp.node.active = true;
        showSp.setAnimation(0, FMConstant.PRAFAB_LIST[type].win_idle_anim, false);

        if (col < 2) {
            num_cnt.position = new Vec3(60, 0, 0);
            num_mult.position = new Vec3(150, 0, 0);
            cell_win.position = new Vec3(-cell_ref, 0, 0);
        } else {
            num_cnt.position = new Vec3(-160, 0, 0);
            num_mult.position = new Vec3(-70, 0, 0);
            cell_win.position = new Vec3(cell_ref, 0, 0);
        }

        this.unschedule(this.hideOneMult);
        this.scheduleOnce(this.hideOneMult, 5);
    }

    onClickMultPanel() {
        this.unschedule(this.hideOneMult);
        this.hideOneMult();
    }

    hideOneMult() {
        xNodeFM.find("node_mult/SpriteSplash", this.node).active = false;
        let mult_panel = xNodeFM.find("node_mult/mult_panel", this.node);
        if (mult_panel) mult_panel.active = false;
    }



    recoverToNormal() {

        FMAudioMgr.Instance.playSound("games/fsExit");
        tween(this.node)
            .to(1, { scale: new Vec3(1, 1, 1) })
            .call(() => {
                FMAudioMgr.Instance.playSound("games/voxMouseEnterBottom");
            })
            .start()

        this.playSpecialDecAnim(false, true, 1);

        let respin_utw = xNodeFM.find("panel/respin_utw", this.node);
        respin_utw.active = true;
        tween(respin_utw).to(0.5, { scale: new Vec3(0, 0, 0) }).call(() => { respin_utw.active = false; }).start()

    }

    // 特殊游戏装饰动画
    playSpecialDecAnim(bTri, bPlay, playT, bHalf = false) {
        let hua = find("Canvas/GameLayer/hua");
        let bg_fg_left = xNodeFM.find("bg_fg_left", hua);
        let bg_fg_right = xNodeFM.find("bg_fg_right", hua);

        let width = hua.getComponent(UITransform).width;
        let left_width = bg_fg_left.getComponent(UITransform).width;
        let right_width = bg_fg_right.getComponent(UITransform).width;


        let bg_tree_1 = xNodeFM.find("panel/bg_tree", this.node);
        let bg_tree_2 = xNodeFM.find("panel/bg_tree-001", this.node);
        let bg_btm_fg = xNodeFM.find("panel/bg_btm_fg", this.node);

        if (bPlay) {
            if (bTri) {
                tween(bg_fg_left)
                    .to(playT, { position: new Vec3(bHalf ? -width / 2 - left_width / 2 : -width / 2 - left_width, bg_fg_left.position.y, 0) })
                    .call(() => { if (!bHalf) bg_fg_left.active = false; })
                    .start()
                tween(bg_fg_right)
                    .to(playT, { position: new Vec3(bHalf ? width / 2 + right_width / 2 : width / 2 + right_width, bg_fg_right.position.y, 0) })
                    .call(() => { if (!bHalf) bg_fg_right.active = false; })
                    .start()

                tween(bg_tree_1).to(playT, { position: new Vec3(bHalf ? -383 : -348, bg_tree_1.position.y, 0) }).start();
                tween(bg_tree_2).to(playT, { position: new Vec3(bHalf ? 383 : 348, bg_tree_1.position.y, 0) }).start();
                bg_btm_fg.active = true;
                bg_btm_fg.position = new Vec3(0, -476, 0);
                bg_btm_fg.scale = new Vec3(1.8, 1.8, 1)
                tween(bg_btm_fg).to(playT, { position: new Vec3(0, bHalf ? -323 : -171, 0), scale: bHalf ? new Vec3(1.5, 1.5, 1) : new Vec3(1.1, 1.1, 1) }).start();

            } else {
                tween(bg_fg_left)
                    .call(() => { bg_fg_left.active = true; })
                    .to(playT, { position: new Vec3(-width / 2, bg_fg_left.position.y, 0) })
                    .start()
                tween(bg_fg_right)
                    .call(() => { bg_fg_right.active = true; })
                    .to(playT, { position: new Vec3(width / 2, bg_fg_right.position.y, 0) })
                    .start()

                tween(bg_tree_1).to(playT, { position: new Vec3(-418, bg_tree_1.position.y, 0) }).start();
                tween(bg_tree_2).to(playT, { position: new Vec3(418, bg_tree_1.position.y, 0) }).start();
                tween(bg_btm_fg)
                    .to(playT, { position: new Vec3(0, -476, 0), scale: new Vec3(1.8, 1.8, 1) })
                    .call(() => { bg_btm_fg.active = false })
                    .start();

            }
        } else {
            bg_fg_left.active = !bTri;
            bg_fg_right.active = !bTri;

            if (!bTri) {
                bg_fg_left.position = new Vec3(-width / 2, bg_fg_left.position.y, 0);
                bg_fg_right.position = new Vec3(width / 2, bg_fg_left.position.y, 0);
            }
            bg_tree_1.position = new Vec3(bTri ? -348 : -418, bg_tree_1.position.y, 0);
            bg_tree_2.position = new Vec3(bTri ? 348 : 418, bg_tree_1.position.y, 0);
            bg_btm_fg.active = bTri;
            if (bTri) {
                bg_btm_fg.position = new Vec3(0, -171, 0);
                bg_btm_fg.scale = new Vec3(1.1, 1.1, 1);
            }
        }
    }

    // 免费游戏触发动画
    async triFreeGameAnim() {
        FMAudioMgr.Instance.stopMusic();

        this.playAvatarAnim("triSpecial");

        FMAudioMgr.Instance.playSound("games/fsIn");

        let triT = 2;
        tween(this.node)
            .to(triT, { scale: new Vec3(0.9, 0.9, 1) })
            .start()

        this.playSpecialDecAnim(true, true, triT);

        await this.delayTime(triT);

        this.layerCtrl.optCtrl.showNorTitle(true, "triFree");
        this.playAvatarAnim("triSpecialSucc");
        this.showNormalBg(false);
        await this.delayTime(0.5);

        let respin_utw = xNodeFM.find("panel/respin_utw", this.node);
        respin_utw.active = true;
        respin_utw.scale = new Vec3(0, 0, 0);
        tween(respin_utw).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start()


        await this.delayTime(0.5);
        // 中间一列变为wild
        let node_respin_wild = xNodeFM.find("node_respin_wild", this.node);
        node_respin_wild.children.forEach((node) => { node.active = false });
        let respin_mask = xNodeFM.find("mask", node_respin_wild);
        respin_mask.active = true;
        let respin_anim1: Animation = xNodeFM.findComponent("f_glow_in_00", node_respin_wild, Animation);
        let respin_anim2: Animation = xNodeFM.findComponent("f_reel_glow_00", node_respin_wild, Animation);
        let respin_anim3: Animation = xNodeFM.findComponent("f_reel_glow_01", node_respin_wild, Animation);
        respin_anim1.node.active = true;
        respin_anim2.node.active = true;
        respin_anim3.node.active = true;
        respin_anim1.play();
        respin_anim2.play();
        respin_anim3.play();

        for (let i = 0; i < 3; i++) {
            let wild_node = this.playCellToTop(i * FMConstant.COL_COUNT + 1, FMConstant.WILD_TYPE);
            wild_node.active = true;
            wild_node.scale = new Vec3(0, 0, 0);
            tween(wild_node)
                .to(0.3, { scale: new Vec3(1, 1, 1) })
                .start();
            wild_node.getComponent(FMCellItem).playBonusWildTri();

            FMAudioMgr.Instance.playSound("games/fsWildHit0" + (i + 1));

            await this.delayTime(0.1);
        }
        await this.delayTime(0.2);
        respin_mask.active = false;

        this._minIdleT += 0.8;
        this._canStop = true;
        FMAudioMgr.Instance.playMusic("bgm_respin");
    }

    // 虚晃一枪--触发动画都只又一半就恢复了
    async triFreeGameFailAnim() {
        FMAudioMgr.Instance.playSound("games/fsIn");
        this.playAvatarAnim("triSpecial");
        let triT = 1;
        tween(this.node)
            .to(triT, { scale: new Vec3(0.95, 0.95, 1) })
            .start()
        this.playSpecialDecAnim(true, true, triT, true);

        await this.delayTime(triT + 0.1);
        this.playAvatarAnim("triSpecialFail");
        this.playSpecialDecAnim(false, true, triT);
        tween(this.node)
            .to(triT, { scale: new Vec3(1, 1, 1) })
            .start()

        await this.delayTime(triT + 0.1);
        this._canStop = true;

    }

    playTurnEffect() {
        if (this._roofLookIdx == 16) {
            this._roofLookIdx += 1;
            FMAudioMgr.Instance.playSound("games/voxRoofLookSuper01");
        } else if (this._roofLookIdx == 17) {
            this._roofLookIdx = 0;
            FMAudioMgr.Instance.playSound("games/voxRoofLookSuper02");
        } else {
            this._roofLookIdx += 1;
            FMAudioMgr.Instance.playSound(`games/voxRoofLook${(this._roofLookIdx) < 10 ? "0" : ""}${this._roofLookIdx}`);
        }
    }

    setAvatarNormalPos(bNormal) {
        let pos;
        if (bNormal) {
            pos = xNodeFM.find("avatar_nor_pos", this.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
        } else {
            pos = xNodeFM.find("avatar_spe_pos", this.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
        }

        this._avatarSp.node.position = this._avatarSp.node.parent.getComponent(UITransform).convertToNodeSpaceAR(pos)
    }

    playAvatarAnim(type) {

        Tween.stopAllByTarget(this._avatarSp);
        let guangSp: sp.Skeleton = xNodeFM.findComponent("guang", this._avatarSp.node, sp.Skeleton);
        if (type == "triSpecial") { // 触发特殊
            FMAudioMgr.Instance.playSound("games/voxTease0" + Math.ceil(Math.random() * 6));
            this._avatarSp.setAnimation(0, "zoom_start", false);
            this._avatarSp.addAnimation(0, "zoom_idle", true);

            guangSp.node.active = true;
            guangSp.setAnimation(0, "fx_zoom_start", false);
            guangSp.addAnimation(0, "fx_zoom_idle", true);
        } else if (type == "triSpecialSucc") {  // 触发特殊成功
            FMAudioMgr.Instance.playSound("games/voxMouseExitBottom2");
            guangSp.node.active = false;
            let entry = this._avatarSp.setAnimation(0, "exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.setAvatarNormalPos(false);
                this._avatarSp.setAnimation(0, "top_enter", false);
                this._avatarSp.addAnimation(0, "top_excite_start", false);
                this._avatarSp.addAnimation(0, "top_excite_lookL", true);
                FMAudioMgr.Instance.playSound("games/voxMouseEnterTop");
            })
        } else if (type == "triSpecialFail") { // 触发特殊失败
            let g_entry = guangSp.addAnimation(0, "fx_zoom_exit", false);
            guangSp.setTrackCompleteListener(g_entry, () => {
                guangSp.setTrackCompleteListener(g_entry, null);
                guangSp.node.active = false;
            })
            let entry = this._avatarSp.addAnimation(0, "zoom_exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        }
        else if (type == "turnR") {
            // this.playTurnEffect();
            this._avatarSp.setAnimation(0, "top_excite_turnR", false);
            this._avatarSp.addAnimation(0, "top_excite_lookR", true);
        } else if (type == "turnL") {
            // this.playTurnEffect();
            this._avatarSp.setAnimation(0, "top_excite_turnL", false);
            this._avatarSp.addAnimation(0, "top_excite_lookL", true);
        } else if (type == "endSpecial") {  // 特殊返回
            FMAudioMgr.Instance.playSound("games/voxMouseExitTop");
            let entry = this._avatarSp.setAnimation(0, "top_exit2", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {

                this._avatarSp.setTrackCompleteListener(entry, null);
                this.setAvatarNormalPos(true);
                let entry2 = this._avatarSp.setAnimation(0, "enter", false);
                this._avatarSp.setTrackCompleteListener(entry2, () => {
                    this._avatarSp.setTrackCompleteListener(entry2, null);
                    this.playAvatarIdleAnim();
                })
            })
        } else if (type == "wildCollect") { // wild图标收集
            let entry = this._avatarSp.setAnimation(0, "wild", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
            guangSp.node.active = true;
            let g_entry = guangSp.setAnimation(0, "fx_wild", false);
            guangSp.setTrackCompleteListener(g_entry, () => {
                guangSp.setTrackCompleteListener(g_entry, null);
                guangSp.node.active = false;
            })
        } else if (type == "small_win") { // 普通赢
            let entry = this._avatarSp.setAnimation(0, "small_win", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "medium_win") {  // 有爆竹赢
            let entry = this._avatarSp.setAnimation(0, "medium_win", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "win_special") { // 特殊玩法赢
            this._avatarSp.setAnimation(0, "top_winoverlay", false);
            this._avatarSp.addAnimation(0, "top_idle", true);
            let delayTime = 8 + Math.random() * 15;
            tween(this._avatarSp)
                .repeatForever(
                    tween()
                        .delay(delayTime)
                        .call(() => {
                            delayTime = 8 + Math.random() * 15
                            let animType = Math.floor(Math.random() * 2) + 2;
                            this._avatarSp.setAnimation(0, "top_idle" + animType, false);
                            this._avatarSp.addAnimation(0, "top_idle", true);
                        })
                )
                .start()
        }

    }

    playAvatarIdleAnim() {
        Tween.stopAllByTarget(this._avatarSp)
        this._avatarSp.setAnimation(0, "idle", true);
        let delayTime = 10 + Math.random() * 15;
        tween(this._avatarSp)
            .repeatForever(
                tween()
                    .delay(delayTime)
                    .call(() => {
                        delayTime = 10 + Math.random() * 15
                        let animType = Math.floor(Math.random() * 3) + 2;
                        this._avatarSp.setAnimation(0, "idle" + animType, false);
                        this._avatarSp.addAnimation(0, "idle", true);
                    })
            )
            .start()
    }

    showNormalBg(bNormal) {
        let bgCtrl: FMSpriteCtrl = xNodeFM.findComponent("bg/ui_reel", this.node, FMSpriteCtrl);
        bgCtrl.setSpriteIndex(bNormal ? 0 : 1);
    }


    roundEnd() {
        if (FMGameManager.getWinAllMoney() > 0) this.playGoldFlyAni();
        FMGameManager.restRound();
        this._canCLickMultPanel = true;
        this._roofLookIdx = 0;
        this.layerCtrl.onPlayFinished();
    }

    playGoldFlyAni() {
        return
        let parentNode: Node = xNodeFM.find("window", this.layerCtrl.node)
        let startPos: Vec3 = parentNode.getComponent(UITransform).convertToNodeSpaceAR(this.layerCtrl.optCtrl.lab_award_num.node.getWorldPosition());
        let endPos: Vec3 = parentNode.getComponent(UITransform).convertToNodeSpaceAR(xNodeFM.find("layout_top/top/node_count/icon", this.layerCtrl.node).getWorldPosition())
        console.log("playGoldFlyAni", startPos, endPos)
        if (startPos && endPos) {
            FMAudioMgr.Instance.playSound("games/coin_fly");
            let info = FMConstant.GOLDFLYCONFIG[2];
            if (FMGameManager.getWinAllMoney() < FMConstant.GOLDFLYCONFIG[0].max) info = FMConstant.GOLDFLYCONFIG[0];
            else if (FMGameManager.getWinAllMoney() < FMConstant.GOLDFLYCONFIG[1].max) info = FMConstant.GOLDFLYCONFIG[1];
            for (let i = 0; i < info.num; i++) {
                let goldFly = instantiate(FMLoadManager.ins.getPrefab("res/load/prefab/games/goldFly"));
                goldFly.children.forEach(value => {
                    value.active = FMGlobal.COUNTRYCODE == value.name
                })
                parentNode.addChild(goldFly);
                goldFly.setPosition(startPos.x + Math.random() * 60 - 30, startPos.y + Math.random() * 60 - 30);
                goldFly.active = false;
                tween(goldFly)
                    .delay(info.time * i)
                    .call(() => goldFly.active = true)
                    .to(1, { position: endPos, angle: Math.random() * 360 }, { easing: "sineIn" })
                    .delay(0.2)
                    .removeSelf()
                    .start()
            }

        }

    }

    update(dt: number) {
        if (!this._startMove) return;
        this._minIdleT -= dt;
        if (this._minIdleT > 0 || this._startLayerCnt !== FMGameManager.getRollLayerCnt() || !this._canStop) return;
        FMGameManager.setRoundTime(FMGameManager.getRoundTime() + dt);
        if (FMGameManager.getCanStop().state !== 1) return;
        this._startMove = false;
        this.cellLayerCtrlList.forEach((layer, col) => {
            if (this.rotatingOuter && col === 1) return;
            layer.setResultData(FMGameManager.getResultData(col));
            layer.setDelayT(FMGameManager.getNormalDelayT(col));
            layer.setStopMove(true);
        });
    }
}
