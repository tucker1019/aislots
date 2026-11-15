import { _decorator, instantiate, Vec3, tween, find, sp, Label, Node, UIOpacity, UITransform, Sprite, Color, isValid, Prefab, Tween, ParticleSystem2D, bezier, NodeEventType, Animation, math, view, Vec2, UI, } from 'cc';
import { frframe } from '../../../frframe/frframe';
import { xNodeFR } from '../../../xtools/xNodeFR';
import { onceRotateInfo } from '../../3rd/game_1018';
import { FRBaseNode } from '../../base/FRBaseNode';
import { __, longToNumber, showMoney } from '../../common/FRUtils';

import { FRConstant, FRSTATE, RandomCellType, WINTYPE } from '../../FRConstant/FRConstant';
import FRLoadManager from '../../load/FRLoadManager';
import { FRGameManager } from '../../mgr/FRGameManager';
import { FRAudioMgr } from './FRAudioMgr';
import { FRCellItem } from './FRCellItem';
import { FRConfigCtrl } from './FRConfigCtrl';
import { FRGameLayerCtrl } from './FRGameLayerCtrl';
import { FRGlobal } from './FRGlobal';

import { FRCellLayer } from './FRCellLayer';
import { FRBigWinCtrl } from './FRBigWinCtrl';
import { FRSpriteCtrl } from './FRSpriteCtrl';
import { FRPlatformMgr } from '../../3rd/FRPlatformMgr';
import type { Frame } from '../../net/FRResultAdapter';

const { ccclass } = _decorator;

@ccclass('FRCenterRollCtrl')
export default class FRCenterRollCtrl extends FRBaseNode {

    private frame?: Frame;
    private rewardAmounts = new Map<number, number>();
    private cellLayerCtrlList: FRCellLayer[] = [];

    layerCtrl: FRGameLayerCtrl = null;

    _startMove: boolean = false;// 是否开始旋转
    _canStop: boolean = false;// 可以停止
    _bStop: boolean = false;    // 是否已经开始停止
    _stopLayerCnt: number = 0;  //停止旋转的列个数--5列都停了才开始处理停止操作
    _startLayerCnt: number = 0; // 开始旋转的列个数--要等到5列都开始转才能停止
    _minIdleT: number = 0;  // 开始转动的额外空转时间

    _canCLickMultPanel = false; // 是否可以点击图标
    _avatarSp: sp.Skeleton = null;
    _hasPlayWildStop = false;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FRGameLayerCtrl);
        this._avatarSp = xNodeFR.findComponent("ui_gate/avatar", this.node, sp.Skeleton);
        this.playAvatarIdleAnim();

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

    private creatRollItem() {
        let nodeList = this.node.getChildByName("node_item_list");
        for (let index = 0; index < nodeList.children.length; index++) {
            let pNode = nodeList.children[index];
            let cellLayerCtrl = pNode.addComponent(FRCellLayer);
            cellLayerCtrl.init(index, this);
            cellLayerCtrl.creatOne();
            this.cellLayerCtrlList.push(cellLayerCtrl);
        }
    }

    resData() {
        this._startMove = false;
        this._canStop = false;
        this._bStop = false;
        this._stopLayerCnt = 0;
        this._startLayerCnt = 0;
        this._minIdleT = 0;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.resData();
        })
        this._hasPlayWildStop = false;
    }

    // 初始化所有节点，即中线动画全部隐藏、top层的全部隐藏、卷轴层的全部显示为默认,且不置灰、
    initLight() {
        // FRAudioMgr.Instance.stopSound();
        this.unscheduleAllCallbacks();
        this.hideAllLineMoney();
        this.hideAllLine();
        this.hideAllKuang();
        this.hideAllCellTop();
        this.showSlotsGray(FRGameManager.isHaveBonus());
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.allCellList.forEach(node => {
                node.active = true;
            })
        })
    }

    /**开始转动 */
    public startRotation() {
        frframe.log.logView("startRotation");
        if (this._startMove) return
        this.unscheduleAllCallbacks();
        if (!FRAudioMgr.Instance.isMusicPlaying()) {
            FRAudioMgr.Instance.playMusic();
        }
        this._canCLickMultPanel = false;

        this.unschedule(this.hideOneMult);
        this.hideOneMult();

        FRGameManager.setStop(false);
        this.resData();
        this.initLight();
        // this.showFreeKuangBgIdleAnim(false);

        this.showBgNormal(true);
        this.playBgLightAnim(false);
        this.playStartRotateGuang(1);

        this._startMove = true;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.setStartMove();
        })


    }

    // 开始旋转--回弹结束
    playStartRoll(index) {
        this._startLayerCnt += 1;
    }

    // 准备停止
    playReadyToStop(index) {

    }

    // 开始滚动回弹
    playBackRoll(index) {
        // if (!this._hasPlayWildStop) {
        //     let data = FRGameManager.getResultData(index)
        //     for (let i = 0; i < FRConstant.ROW_COUNT; i++) {
        //         if (data[i] == FRConstant.WILD_TYPE) {
        //             this._hasPlayWildStop = true;
        //             FRAudioMgr.Instance.playSound("games/wild");
        //         }
        //     }

        // }
    }

    // 停止转动
    playStopRoll(index) {
        this._stopLayerCnt += 1;
        if (this._stopLayerCnt == FRConstant.COL_COUNT) {
            void this.oneRoundEnd().catch(error => this.layerCtrl.handleAnimationError(error));
        }
        // this.hideTriFreeGuang();
    }

    acceptFrame(frame: Frame, rewardAmounts: Map<number, number>) {
        this.frame = frame;
        this.rewardAmounts = rewardAmounts;
        if (frame.mode === 'base' && !frame.triggeredFree && Math.random() < 0.05) {
            this.playAvatarAnim('triSpecialFail');
            void this.triFreeGameAnim(0, true);
        } else this._canStop = true;
    }

    showStoredBoard(icons: number[]) {
        this.initLight();
        this.cellLayerCtrlList.forEach((layer, col) => {
            layer.showStoredSymbols(icons.filter((_, idx) => idx % FRConstant.COL_COUNT === col));
        });
    }

    cancelRoll(icons: number[]) {
        this.resData();
        this.showStoredBoard(icons);
    }

    restoreSpecial(remaining: number) {
        this.playBgAnim();
        this.playShowBonusYun(true, false);
        this.showBgNormal(false);
        this.showFreeBgGuangAnim(true);
        this.showFreeTitle(true);
        this.layerCtrl.optCtrl.initSpecialCnt(remaining);
        FRGameManager.setRandomList(RandomCellType.BONUS);
        FRAudioMgr.Instance.stopMusic();
        FRAudioMgr.Instance.playMusic('bgm2');
    }

    startSpecialRotation() {
        FRGameManager.specialSpin = true;
        this.resData();
        this.initLight();
        FRGameManager.setState(FRSTATE.RUNING);
        this.playStartRotateGuang(2);
        this._startMove = true;
        this._minIdleT = 0.75;
        this.cellLayerCtrlList.forEach(layer => layer.setStartMove());
    }

    async oneRoundEnd() {
        const frame = this.frame;
        const rotateData = FRGameManager.getRotateData(true);
        if (!frame || !rotateData) return;
        const awardList = rotateData.mAwardList;
        if (frame.mode === 'base') {
            if (awardList?.length) {
                if (!awardList.some(award => award.flag_id === 11)) await this.playWildFlyAnim(rotateData.mIcons);
                this.playBgLightAnim(true);
                this.showSlotsGray(true);
                this.showWinTrace(awardList, awardList.length);
                await this.showBottomWin(awardList);
            }
        } else {
            if (awardList?.length) {
                const mFreeIcons = rotateData.mIcons;
                let mIconIdxs = awardList[0].mIconIdxs.slice();
                mIconIdxs.sort((a, b) => b - a).sort((a, b) => Math.floor((a - 1) % 3) - Math.floor((b - 1) % 3));

                this.showSlotsGray(true);
                let totalWin = frame.totalWinAmount - frame.winAmount;
                FRAudioMgr.Instance.playSound("games/Special_Win");
                for (let i = 0; i < mIconIdxs.length; i++) {
                    let cellIdx = mIconIdxs[i] - 1;
                    let cellType = mFreeIcons[mIconIdxs[i] - 1];
                    let cellTop = this.playCellToTop(cellIdx, cellType);
                    cellTop.active = true;
                    cellTop.getComponent(FRCellItem).playWinAni(false);
                    this.playKuang(cellIdx, cellType);
                    // this.playFreeNumFly();

                    let numNode = cellTop.getComponent(FRCellItem).getBonusNumNode();
                    numNode.getComponent(UIOpacity).opacity = 255;
                    const win = this.rewardAmounts.get(cellIdx + 1) || 0;
                    let flyNode = instantiate(numNode);
                    flyNode.getComponent(Label).string = showMoney(win);
                    flyNode.active = false;
                    flyNode.parent = this.layerCtrl.node;
                    let endPos = flyNode.parent.getComponent(UITransform).convertToNodeSpaceAR(this.layerCtrl.optCtrl.getWinBigPos());
                    flyNode.position = flyNode.parent.getComponent(UITransform).convertToNodeSpaceAR(numNode.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
                    tween(flyNode)
                        .delay(0.5 + i * 0.3)
                        .call(() => {
                            flyNode.active = true;
                            numNode.getComponent(UIOpacity).opacity = 160;
                            FRAudioMgr.Instance.playSound("games/WinNum_Fly");
                        })
                        .to(0.5, { position: endPos })
                        .call(() => {
                            FRAudioMgr.Instance.playSound("games/yinjie/scale" + (i + 1));
                            flyNode.destroy();
                            totalWin += win;
                            FRGameManager.setWinMoney(totalWin);
                            this.layerCtrl.optCtrl.showNorTitle(false);
                            this.layerCtrl.optCtrl.setBigAwardNum(totalWin, 1, false);
                        })
                        .start()

                    // await this.delayTime(0.2);
                }
                await this.delayTime(1.1 + (mIconIdxs.length - 1) * 0.3);
            }
            await this.delayTime(0.5);

            if (frame.nextAction === 'complete') {
                let totalWin = frame.totalWinAmount;
                await this.checkBigWin(totalWin);
                this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5);
                await this.delayTime(0.5);

                this.recoverToNormal();
                this.showBgNormal(true);
                this.layerCtrl.optCtrl.recoverNormal();
                this.showFreeBgGuangAnim(false);
                this.showFreeTitle(false);
                this.playShowBonusYun(false, true);
                // this._avatarSp.node.getChildByName("mult").active = false;

                this.playAvatarAnim("respawn");

                // this.layerCtrl.optCtrl.showNorTitle(true);
                FRGameManager.setRandomList()


                FRAudioMgr.Instance.stopMusic();
                FRAudioMgr.Instance.playMusic();

                await this.delayTime(0.5);


            }
        }

        FRGameManager.setWinMoney(frame.totalWinAmount);
        this.layerCtrl.optCtrl.setAwardNum(frame.totalWinAmount);
        if (frame.nextAction === 'continue') {
            if (frame.triggeredFree && awardList?.length) await this.delayTime(0.6);
            await this.layerCtrl.continuePlay(frame);
            return;
        }
        if (FRGameManager.getAudoNum() > 0) await this.delayTime(0.3);
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
                let type = cell.getComponent(FRCellItem).type;
                let cellTop = this.playCellToTop(idx, type);
                cellTop.active = true;
                cellTop.getComponent(FRCellItem).playWinAni();
                cell.active = false;
                this.playKuang(idx, type);
            }

            if (flag_id > 0 && flag_id !== 11) {
                this.playOneLine(flag_id - 1);
                if (bShowMoney) {
                    this.playOneLineMoney(flag_id - 1, money);
                }
            }

            FRAudioMgr.Instance.playSound("games/Flashing1");
        }

        if (awardList) {
            this.hideAllLineMoney();
            this.hideAllLine();
            this.hideAllKuang();
            this.hideAllCellTop();
            this.cellLayerCtrlList.forEach(layerCtrl => {
                layerCtrl.allCellList.forEach(node => {
                    node.active = true;
                })
            })
            if (index == awardList.length) {  // 总的
                for (let i = 0; i < awardList.length; i++) {
                    playLine(awardList[i], false);
                }
                this.scheduleOnce(() => this.showWinTrace(awardList, 0), 2);
            } else {    // 单的
                playLine(awardList[index], true);
                this.scheduleOnce(() => this.showWinTrace(awardList, index + 1), 2);
            }
        }

    }

    showBottomWin(awardList) {
        return new Promise<void>(async (resolve, reject) => {
            let roundWinMoney: number = 0;
            let hasSpecial = false;
            awardList.forEach(arardInfo => {
                if (arardInfo.flag_id == 11) {
                    hasSpecial = true
                }
                roundWinMoney += longToNumber(arardInfo.mMoney);
            })

            let totalWin = roundWinMoney;
            let winType = FRGameManager.getWinType(roundWinMoney, FRGameManager.getTotalBitNum());
            await this.checkBigWin(roundWinMoney);

            if (winType < 3) {
                let effList = [["Yeah", "Hao", "HeiHei", "Aha"], ["ZhenHao", "LiHai"], ["GongXi"]];
                let effName = effList[winType][Math.floor(Math.random() * effList[winType].length)];
                FRAudioMgr.Instance.playSound("games/renwu/" + effName);
                this.playAvatarAnim("winSmall");
            } else {
                this.playAvatarAnim("winBig");
            }

            FRGameManager.setWinMoney(totalWin);
            this.layerCtrl.optCtrl.showNorTitle(false);
            this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5, hasSpecial);

            resolve();
        })
    }

    /**
     * 检查播放bigwin
     * @param coin 赢钱
     * @param bitNum 总压注
     * @param noDelayT 不播bigwin的延迟时常
     * @returns 
     */
    checkBigWin(coin: number, noDelayT: number = 0) {
        return new Promise<void>(async (resolve, reject) => {
            let bitNum = FRGameManager.getTotalBitNum()
            let bigWinType = FRGameManager.getBigWinType(coin, bitNum);
            if (!bigWinType) {
                this.scheduleOnce(() => { resolve() }, noDelayT)
                return
            }

            let endFunc = () => {
                resolve();
            }
            await this.delayTime(0.5);
            let node = xNodeFR.find("Canvas/GameLayer/node_ani/big_win");
            if (!node) {
                let prefab = FRLoadManager.ins.getPrefab("res/load/prefab/games/big_win");
                node = instantiate(prefab);
                node.parent = xNodeFR.find("Canvas/GameLayer/node_ani");
            }
            node.getComponent(FRBigWinCtrl).playBigWin(coin, bigWinType, endFunc);
        })
    }


    playWildFlyAnim(mIcons) {
        return new Promise<void>(async (resolve, reject) => {
            let hasPlay = false, playFly = false;
            let node_wildFly = this.node.getChildByName("node_wildFly");

            let playList = [[6, 3, 0], [7, 4, 1, 10], [8, 5, 2]];
            for (let i = 0; i < playList.length; i++) {
                let bAwait = false;
                for (let j = 0; j < playList[i].length; j++) {
                    if (FRConstant.BONUS_TYPE.indexOf(mIcons[playList[i][j]]) >= 0) {
                        hasPlay = true;
                        bAwait = true;
                        FRAudioMgr.Instance.playSound("games/Particle");

                        let node = FRLoadManager.ins.showGetPrefab("res/load/prefab/games/wild_fly", node_wildFly);
                        node.active = true;
                        node.position = node_wildFly.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(playList[i][j]));
                        let quan = node.getChildByName("quan");
                        quan.active = true;
                        quan.getComponent(Animation).play();
                        let par = node.getChildByName("par");
                        par.active = false;

                        let sPos = new Vec3(0, 0, 0);
                        let ePos = node.getComponent(UITransform).convertToNodeSpaceAR(this.getHBWPos());
                        let cPos = new Vec3(sPos.x + 200, ePos.y - 200, 0)
                        tween(par)
                            .delay(0.2)
                            .call(() => {
                                par.active = true;
                            })
                            .to(0.35, { position: ePos }, {
                                "onUpdate": (target: Vec3, radio: number) => {
                                    let sx = par.position.x as number;
                                    let sy = par?.position.y as number;
                                    let sz = par?.position.z as number;
                                    let x = bezier(sx, sPos.x, cPos.x, ePos.x, radio);
                                    let y = bezier(sy, sPos.y, cPos.y, ePos.y, radio);
                                    // let z = bezier(sz, 0, 0, 0, radio);
                                    par?.setPosition(new Vec3(x, y))
                                }
                            })
                            .call(() => {
                                FRAudioMgr.Instance.playSound("games/Particle_Fly");
                                if (!playFly) {
                                    playFly = true;
                                    this.playAvatarAnim("wildCollect")
                                }
                            })
                            .delay(0.3)
                            .call(() => {
                                node.destroy();
                            })
                            .start()

                    }
                }
                if (bAwait) {
                    await this.delayTime(0.1)
                }
            }

            if (hasPlay) {
                await this.delayTime(0.6)
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
        let cell = xNodeFR.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FRLoadManager.ins.getPrefab(FRConstant.PRAFAB_CELL_WIN));
            cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(index));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FRCellItem).initTypeView(type);

        }
        if (cell.getComponent(FRCellItem).type !== type) {
            cell.getComponent(FRCellItem).setTypeView(type);
        }

        return cell
    }
    copyCellToTop(ori_cell) {
        let node_top = this.node.getChildByName("node_top");
        let type = ori_cell.getComponent(FRCellItem).type;
        let index = ori_cell.getComponent(FRCellItem).index;
        let cell = xNodeFR.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FRLoadManager.ins.getPrefab(FRConstant.PRAFAB_CELL_WIN));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FRCellItem).initTypeView(type);

        }
        cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(ori_cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        cell.active = true;
        cell.getComponent(FRCellItem).setTypeView(type);
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
        let node = xNodeFR.find("mask", this.node);
        node && (node.active = bShow);
    }


    // 中线-线动画 flag_id--0开始
    playOneLine(flag_id: number) {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            let line = xNodeFR.find(`line${flag_id + 1}`, node_line);
            // if (!line) {
            //     line = instantiate(FRLoadManager.ins.getPrefab("res/load/prefab/games/win_payline"));
            //     node_line.addChild(line);
            //     line.position = new Vec3(0, ([0, 1, -1][flag_id] || 0) * 183, 0);
            //     line.eulerAngles = new Vec3(0, 0, [0, 0, 0, -45, 45][flag_id]);
            //     line.scale = new Vec3(flag_id < 3 ? 1.7 : 2, 1.7, 0);
            //     line.name = `line${flag_id}`;
            // }
            line.active = true;
        }
        let num_line = xNodeFR.find("ui_gate/payline_win", this.node);
        if (num_line) {
            num_line.getChildByName("payline_on_left_" + (flag_id + 1)).active = true;
            num_line.getChildByName("payline_on_right_" + (flag_id + 1)).active = true;
        }
    }
    hideAllLine() {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            node_line.children.forEach(node => {
                node.active = false;
            })
        }
        let num_line = xNodeFR.find("ui_gate/payline_win", this.node);
        if (num_line) {
            num_line.children.forEach(node => {
                node.active = false;
            })
        }
    }

    //中线赢分 flag_id--0开始
    playOneLineMoney(flag_id: number, money: number) {
        let node_money = this.node.getChildByName("node_money");
        let money_id;
        if (flag_id == 0) {
            money_id = 0;
        } else if (flag_id < 5) {
            money_id = 1;
        } else if (flag_id < 9) {
            money_id = 2;
        } else {
            money_id = 3;
        }
        let mask = node_money.getChildByName(`mask_${money_id}`);
        mask.active = true;
        xNodeFR.setLabel("num_info", mask, showMoney(money));
    }
    hideAllLineMoney() {
        let node_money = this.node.getChildByName("node_money");
        node_money.children.forEach(node => node.active = false);
    }

    /**
     * 中线框动画
     * @param idx 0开始
     */
    playKuang(idx: number, type) {
        let node_kuang = this.node.getChildByName("node_kuang");
        if (node_kuang) {
            let kuang = xNodeFR.find(`kuang${idx}`, node_kuang);
            if (!kuang) {
                kuang = instantiate(FRLoadManager.ins.getPrefab("res/load/prefab/games/win_kuang"));
                node_kuang.addChild(kuang);
                kuang.position = node_kuang.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(idx));
                kuang.name = `kuang${idx}`;
            }
            kuang.active = true;
            if (type > 10) {
                type = 8
            }
            kuang.getChildByName("ps_vfx_a").getComponent(FRSpriteCtrl).setSpriteIndex(type - 1)

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


    getHBWPos() {
        return xNodeFR.find("pos_hb", this._avatarSp.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0))
    }

    /**
     * 
     * @param idx 0开始
     */
    getWorldPosByIdx(idx: number): Vec3 {
        let col = idx % FRConstant.COL_COUNT;
        let row = Math.floor(idx / FRConstant.COL_COUNT);

        let y = FRConstant.CELL_SIZE.height * (row + 1 / 2);
        let pos = this.cellLayerCtrlList[col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return pos
    }

    // idx 0开始
    getCellByIdx(idx: number) {
        let col = idx % FRConstant.COL_COUNT;
        let row = Math.floor(idx / FRConstant.COL_COUNT);
        let node = this.cellLayerCtrlList[col].resultCell[row];
        return node;
    }


    clickMultPanel(event) {
        if (FRGameManager.getAudoNum() > 0) {
            return
        }
        if (!this._canCLickMultPanel) {
            return
        }
        let node = event.target;

        let wPos = event.getUILocation();
        let clickPos = node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(wPos.x, wPos.y, 0));
        let col, row;
        let posX, posY;
        if (clickPos.x < -107) {
            col = 0;
            posX = -135;
        } else if (clickPos.x < 107) {
            col = 1;
            posX = 90;
        } else {
            col = 2;
            posX = 135;
        }

        let height = FRConstant.CELL_SIZE.height;
        if (col == 1) {
            if (clickPos.y < -height) {
                row = 0;
                posY = -height * 3 / 2;
            } else if (clickPos.y < 0) {
                row = 1;
                posY = -height / 2;
            } else if (clickPos.y < height) {
                row = 2;
                posY = height / 2;
            } else {
                row = 3;
                posY = height * 3 / 2;
            }
        } else {
            if (clickPos.y < -height / 2) {
                row = 0;
                posY = -height;
            } else if (clickPos.y < height / 2) {
                row = 1;
                posY = 0;
            } else {
                row = 2;
                posY = height;
            }
        }

        let cellIdx = row * 3 + col;
        let cell = this.getCellByIdx(cellIdx);
        let type = cell.getComponent(FRCellItem).type;

        if (type == 0) {
            return
        }

        let panel = node.getChildByName("mult_panel");
        if (panel && panel.active) {
            panel.active = false;
        }
        if (!panel) {
            panel = instantiate(FRLoadManager.ins.getPrefab("res/load/prefab/games/mult_panel"));
            node.addChild(panel);
            panel.name = "mult_panel";
            panel.on("click", this.onClickMultPanel, this);
        }


        FRAudioMgr.Instance.playSound("games/Icon_Click");
        xNodeFR.find("node_mult/mask", this.node).active = true;
        panel.active = true;
        panel.position = new Vec3(posX, posY, 0)
        panel.getComponent(UITransform).contentSize.height = type == FRConstant.WILD_TYPE ? 240 : 200;
        let num_red = panel.getChildByName("num_red");
        let num_yellow = panel.getChildByName("num_yellow");
        let num_bonus = panel.getChildByName("num_bonus");
        let cell_win = panel.getChildByName("cell_win");
        num_red.active = FRConstant.BONUS_TYPE.indexOf(type) < 0;
        num_yellow.active = FRConstant.BONUS_TYPE.indexOf(type) < 0;
        num_bonus.active = FRConstant.BONUS_TYPE.indexOf(type) >= 0;
        xNodeFR.setLabel("", num_red, "3");
        xNodeFR.setLabel("", num_yellow, "" + FRConstant.PRAFAB_LIST[type].MULT);
        cell_win.children.forEach(node => node.active = false);
        let showSp: sp.Skeleton = xNodeFR.findComponent(FRConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
        if (showSp) {
            showSp.node.active = true;
            showSp.setAnimation(0, FRConstant.PRAFAB_LIST[type].stop_anim, false);
        } else {
            cell_win.getComponent(FRCellItem).initTypeView(type, this);
        }

        if (col < 2) {
            num_red.position = new Vec3(43, 0, 0);
            num_yellow.position = new Vec3(126, 0, 0);
            num_bonus.position = new Vec3(100, 0, 0)
            cell_win.position = new Vec3(-85, -3, 0);
        } else {
            num_red.position = new Vec3(-160, 0, 0);
            num_yellow.position = new Vec3(-77, 0, 0);
            num_bonus.position = new Vec3(-104, 0, 0)
            cell_win.position = new Vec3(85, -3, 0);
        }

        this.unschedule(this.hideOneMult);
        this.scheduleOnce(this.hideOneMult, 5);
    }

    onClickMultPanel() {
        this.unschedule(this.hideOneMult);
        this.hideOneMult();
    }

    hideOneMult() {
        xNodeFR.find("node_mult/mask", this.node).active = false;
        let mult_panel = xNodeFR.find("node_mult/mult_panel", this.node);
        if (mult_panel) mult_panel.active = false;
    }



    playBgAnim() {
        // let bgNode = this.layerCtrl.node;
        // tween(bgNode).to(1.2, { scale: new Vec3(0.9, 0.9, 1) }).start();
        let bg = xNodeFR.find("Canvas/GameLayer/bg");
        let layout_center = xNodeFR.find("Canvas/GameLayer/layout_center");
        let layout_bottom = xNodeFR.find("Canvas/GameLayer/layout_bottom");
        let tri_bonus = xNodeFR.find("Canvas/GameLayer/tri_bonus");
        // let ui_bg = xNodeFR.find("Canvas/GameLayer/ui_bg");
        let anim = tween().to(0.8, { scale: new Vec3(0.9, 0.9, 1) })
        anim.clone(bg).start();
        anim.clone(layout_center).start();
        anim.clone(layout_bottom).start();
        anim.clone(tri_bonus).start();
        // anim.clone(ui_bg).start();
    }

    recoverToNormal() {
        // FRAudioMgr.Instance.playSound("games/return");           


        // let bgNode = this.layerCtrl.node;
        // tween(bgNode).to(1.2, { scale: new Vec3(1, 1, 1) }).start();
        let bg = xNodeFR.find("Canvas/GameLayer/bg");
        let layout_center = xNodeFR.find("Canvas/GameLayer/layout_center");
        let layout_bottom = xNodeFR.find("Canvas/GameLayer/layout_bottom");
        let tri_bonus = xNodeFR.find("Canvas/GameLayer/tri_bonus");
        // let ui_bg = xNodeFR.find("Canvas/GameLayer/ui_bg");
        let reduceAnim = tween().to(0.8, { scale: new Vec3(1, 1, 1) })
        reduceAnim.clone(bg).start();
        reduceAnim.clone(layout_center).start();
        reduceAnim.clone(layout_bottom).start();
        reduceAnim.clone(tri_bonus).start();
        // reduceAnim.clone(ui_bg).start();
    }

    playShowBonusYun(bShow, bPlay) {
        let panel_4 = xNodeFR.find("node_panel/panel_4", this.node);
        let panel_4_2 = xNodeFR.find("node_panel/panel_4_2", this.node);
        let panel_5 = xNodeFR.find("node_panel/panel_5", this.node);
        let panel_5_2 = xNodeFR.find("node_panel/panel_5_2", this.node);

        Tween.stopAllByTarget(panel_4);
        Tween.stopAllByTarget(panel_4_2);
        Tween.stopAllByTarget(panel_5);
        Tween.stopAllByTarget(panel_5_2);
        if (bPlay) {
            if (bShow) {
                FRAudioMgr.Instance.playSound("games/Zoom");
                tween(panel_4).call(() => { panel_4.active = true; panel_4.position = new Vec3(-500, 365, 0); }).to(1.2, { position: new Vec3(-360, 365, 0) }).start();
                tween(panel_4_2).call(() => { panel_4_2.active = true; panel_4_2.position = new Vec3(500, 365, 0); }).to(1.2, { position: new Vec3(360, 365, 0) }).start();
                tween(panel_5).call(() => { panel_5.active = true; panel_5.position = new Vec3(-510, -460, 0); }).to(1.2, { position: new Vec3(-373, -460, 0) }).start();
                tween(panel_5_2).call(() => { panel_5_2.active = true; panel_5_2.position = new Vec3(510, -460, 0); }).to(1.2, { position: new Vec3(373, -460, 0) }).start();
            } else {
                FRAudioMgr.Instance.playSound("games/UI_Quit");
                tween(panel_4).to(1.2, { position: new Vec3(-500, 365, 0) }).call(() => { panel_4.active = false; }).start();
                tween(panel_4_2).to(1.2, { position: new Vec3(500, 365, 0) }).call(() => { panel_4_2.active = false; }).start();
                tween(panel_5).to(1.2, { position: new Vec3(-510, -460, 0) }).call(() => { panel_5.active = false; }).start();
                tween(panel_5_2).to(1.2, { position: new Vec3(510, -460, 0) }).call(() => { panel_5_2.active = false; }).start();
            }
        } else {
            panel_4.active = bShow;
            panel_4_2.active = bShow;
            panel_5.active = bShow;
            panel_5_2.active = bShow;
        }
    }

    // 免费游戏触发动画--卷轴收缩--rabbit图标--卷轴背景变红--次数弹窗
    async triFreeGameAnim(freeCnt = 0, bFail = false) {
        FRAudioMgr.Instance.stopMusic();

        let eff1 = ["Special1", "Special2"][Math.floor(Math.random() * 2)];
        FRAudioMgr.Instance.playSound("games/renwu/" + eff1);

        this.playBgAnim();
        this.playShowBonusYun(true, true);

        let fs_vfx_c_screen_opa: UIOpacity = xNodeFR.findComponent("ui_gate/fs_vfx_c_screen", this.node, UIOpacity)
        fs_vfx_c_screen_opa.node.active = true;
        fs_vfx_c_screen_opa.opacity = 0;
        tween(fs_vfx_c_screen_opa)
            .tag(2)
            .repeat(20, tween().to(0.5, { opacity: 255 }).to(0.5, { opacity: 0 }))
            .start()

        let tri_bonus = xNodeFR.find("Canvas/GameLayer/tri_bonus");
        tri_bonus.active = true;
        tri_bonus.children.forEach((node) => {
            node.active = false;
        })
        let guangshu1 = xNodeFR.find("guangshu1", tri_bonus);
        let guangshu3 = xNodeFR.find("guangshu3", tri_bonus);
        tween(guangshu1)
            .tag(2)
            .repeat(5, tween()
                .call(() => { guangshu1.active = true; guangshu1.scale = new Vec3(1, 0.2, 1); guangshu1.eulerAngles = new Vec3(0, 0, -55); })
                .to(0.2, { scale: new Vec3(1.2, 0.8, 1) })
                .to(2, { eulerAngles: new Vec3(0, 0, -25) })
                .to(0.2, { scale: new Vec3(1, 0.2, 1) })
                .call(() => { guangshu1.active = false; })
                .delay(0.6)
            )
            .start()
        tween(guangshu3)
            .tag(2)
            .delay(1.5)
            .repeat(5, tween()
                .call(() => { guangshu3.active = true; guangshu3.scale = new Vec3(1, 0.2, 1); guangshu3.eulerAngles = new Vec3(0, 0, -55); })
                .to(0.2, { scale: new Vec3(1.2, 0.8, 1) })
                .to(2, { eulerAngles: new Vec3(0, 0, -25) })
                .to(0.2, { scale: new Vec3(1, 0.2, 1) })
                .call(() => { guangshu3.active = false; })
                .delay(0.6)
            )
            .start()

        let guangshu2 = xNodeFR.find("guangshu2", tri_bonus);
        tween(guangshu2)
            .tag(2)
            .repeat(5, tween()
                .call(() => { guangshu2.active = true; guangshu2.scale = new Vec3(1, 0.2, 1); guangshu2.eulerAngles = new Vec3(0, 0, 55); })
                .to(0.2, { scale: new Vec3(1.2, 0.8, 1) })
                .to(2, { eulerAngles: new Vec3(0, 0, 25) })
                .to(0.2, { scale: new Vec3(1, 0.2, 1) })
                .call(() => { guangshu2.active = false; })
                .delay(0.6)
            )
            .start()
        let guangshu4 = xNodeFR.find("guangshu4", tri_bonus);
        tween(guangshu4)
            .tag(2)
            .delay(1.5)
            .repeat(5, tween()
                .call(() => { guangshu4.active = true; guangshu4.scale = new Vec3(1, 0.2, 1); guangshu4.eulerAngles = new Vec3(0, 0, 55); })
                .to(0.2, { scale: new Vec3(1.2, 0.8, 1) })
                .to(2, { eulerAngles: new Vec3(0, 0, 25) })
                .to(0.2, { scale: new Vec3(1, 0.2, 1) })
                .call(() => { guangshu4.active = false; })
                .delay(0.6)
            )
            .start()

        let logoOpa: UIOpacity = xNodeFR.findComponent("logo", tri_bonus, UIOpacity);
        logoOpa.node.active = true;
        logoOpa.opacity = 0;
        tween(logoOpa)
            .tag(2)
            .repeat(5, tween().to(0.8, { opacity: 190 }).to(0.8, { opacity: 60 }))
            .start();
        tween(logoOpa.node)
            .tag(2)
            .repeat(5, tween().to(0.8, { scale: new Vec3(1.2, 1.2, 1) }).to(0.8, { scale: new Vec3(1.1, 1.1, 1) }))
            .start();

        await this.delayTime(0.6);
        // 卷轴背景变红色
        this.showBgNormal(false);
        await this.delayTime(1.5);

        if (bFail) {
            this.playAvatarAnim("triSpecialFailBack");
            Tween.stopAllByTag(2);
            tri_bonus.active = false;
            this.recoverToNormal();
            this.playShowBonusYun(false, true);
            this.showBgNormal(true);
            this._canStop = true;
            FRAudioMgr.Instance.playMusic();
        } else {
            // 出现次数弹窗、角色跳到弹窗位置
            FRAudioMgr.Instance.playSound("games/renwu/ZLYZ");
            this.playAvatarAnim("freespin");
            await this.delayTime(0.2);

            FRAudioMgr.Instance.playSound("games/Fireworks");
            Tween.stopAllByTarget(logoOpa);
            logoOpa.node.active = false;
            let popOpa: UIOpacity = xNodeFR.findComponent("pop_cnt", tri_bonus, UIOpacity);
            popOpa.node.active = true;
            popOpa.opacity = 20;
            tween(popOpa).to(0.3, { opacity: 255 }).start()
            popOpa.node.scale = new Vec3(0.8, 0.8, 1)
            tween(popOpa.node).to(0.3, { scale: new Vec3(1.4, 1.4, 1) }).to(0.2, { scale: new Vec3(1.3, 1.3, 1) }).start()
            Tween.stopAllByTarget(fs_vfx_c_screen_opa);
            fs_vfx_c_screen_opa.opacity = 0;

            let rabbit = xNodeFR.find("pop_cnt/rabbit", tri_bonus);
            rabbit.position = new Vec3(0, -26, 0);
            rabbit.active = false;

            await this.delayTime(0.4);
            tween(rabbit).call(() => { rabbit.active = true; }).to(0.2, { position: new Vec3(0, 310, 0) }).to(0.1, { position: new Vec3(0, 280, 0) }).start();

            let bgMask = xNodeFR.find("SpriteSplash", tri_bonus);
            bgMask.active = true;

            let yh3: Animation = xNodeFR.findComponent("yh3", tri_bonus, Animation);
            yh3.node.active = true;
            yh3.play();
            await this.delayTime(0.1);
            let yh1: Animation = xNodeFR.findComponent("yh1", tri_bonus, Animation);
            yh1.node.active = true;
            yh1.play();
            await this.delayTime(0.1);
            let yh2: Animation = xNodeFR.findComponent("yh2", tri_bonus, Animation);
            yh2.node.active = true;
            yh2.play();

            await this.delayTime(1.8);
            // 弹窗消失、bonus图标加进卷轴动画
            FRAudioMgr.Instance.playMusic("bgm2");
            Tween.stopAllByTarget(guangshu1);
            Tween.stopAllByTarget(guangshu2);
            Tween.stopAllByTarget(guangshu3);
            Tween.stopAllByTarget(guangshu4);
            guangshu1.active = false;
            guangshu2.active = false;
            guangshu3.active = false;
            guangshu4.active = false;
            bgMask.active = false;
            this.layerCtrl.optCtrl.initSpecialCnt(freeCnt);
            tween(rabbit).to(0.2, { position: new Vec3(0, -26, 0) }).call(() => { rabbit.active = false }).start();
            tween(popOpa.node).to(0.8, { scale: new Vec3(0.8, 0.8, 1) }).start()
            tween(popOpa).delay(0.8).to(0.8, { opacity: 0 }).start()

            this.showFreeBgGuangAnim(true);
            this.showFreeTitle(true);
            this.playBgLightAnim(true);

            let fs_vfx_e_add_opa: UIOpacity = xNodeFR.findComponent("fs_vfx_e_add", tri_bonus, UIOpacity);
            fs_vfx_e_add_opa.node.active = true;
            fs_vfx_e_add_opa.node.scale = new Vec3(0, 0, 0);
            fs_vfx_e_add_opa.opacity = 255;
            tween(fs_vfx_e_add_opa.node).to(0.8, { scale: new Vec3(2.5, 2.5, 1) }).start()
            tween(fs_vfx_e_add_opa)
                .delay(1.8)
                .to(1.2, { opacity: 0 })
                .call(() => { fs_vfx_e_add_opa.node.active = false }).start();

            let guangquanOpa: UIOpacity = xNodeFR.findComponent("guangquan", tri_bonus, UIOpacity);
            guangquanOpa.node.active = true;
            guangquanOpa.node.scale = new Vec3(0, 0, 0);
            guangquanOpa.opacity = 255;
            tween(guangquanOpa.node).to(1, { scale: new Vec3(1.5, 1.5, 1) }).start();
            tween(guangquanOpa).delay(0.8).to(0.5, { opacity: 0 }).start();
            FRGameManager.setRandomList(RandomCellType.EMPTY)

            let mask = xNodeFR.find("mask", tri_bonus);
            mask.active = true;
            mask.position = tri_bonus.getComponent(UITransform).convertToNodeSpaceAR(this.node.getChildByName("node_item_list").getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)))
            for (let i = 0; i < 10; i++) {
                let cnt = Math.floor(Math.random() * 2) + 1;
                let endCol = [[0, 1], [0, 2], [1, 2]][Math.floor(Math.random() * 3)];
                for (let j = 0; j < cnt; j++) {
                    FRAudioMgr.Instance.playSound("games/Num_Fly");
                    let b_node = instantiate(FRLoadManager.ins.getPrefab(FRConstant.PRAFAB_CELL));
                    b_node.parent = tri_bonus;
                    b_node.position = new Vec3(0, 200, 0);

                    b_node.getComponent(FRCellItem).initTypeView(FRGameManager.getRandonBonusType());
                    let scale = Number((Math.random() * 0.3 + 0.9).toFixed(2));
                    b_node.scale = new Vec3(scale, scale, 0);

                    let ePos = new Vec3([-212, 0, 212][endCol[j]], 100, 0);
                    tween(b_node)
                        .parallel(
                            tween().to(0.1, { scale: new Vec3(1.3, 1.3, 1) })
                                .to(0.1, { scale: new Vec3(1, 1, 1) }),
                            tween().to(0.2, { position: ePos })
                        )
                        .call(() => {
                            let copyNode = instantiate(b_node);
                            copyNode.parent = mask.children[endCol[j]];
                            copyNode.position = new Vec3(0, 39, 0);

                            tween(copyNode)
                                .to(0.6, { position: new Vec3(0, -500, 0) })
                                .call(() => {
                                    copyNode.destroy();

                                    if (i == 9 && j == cnt - 1) {
                                        Tween.stopAllByTag(2);
                                        tri_bonus.active = false;
                                        
                                    }
                                }).start()

                            b_node.destroy();

                        })
                        .start()
                }
                await this.delayTime(0.3)
            }

            // await this.delayTime(1)
            // tri_bonus.active = false;

            FRGameManager.setRandomList(RandomCellType.BONUS)



        }
    }

    showFreeBgGuangAnim(bShow) {
        let bw_vfx_l_screen_01: Animation = xNodeFR.findComponent("ui_gate/bw_vfx_l_screen_01", this.node, Animation);
        bw_vfx_l_screen_01.node.active = bShow;
        if (bShow) {
            bw_vfx_l_screen_01.play();
        }

        let fs_vfx_b_add_00: Animation = xNodeFR.findComponent("ui_gate/fs_vfx_b_add_00", this.node, Animation);
        fs_vfx_b_add_00.node.active = bShow;
        if (bShow) {
            fs_vfx_b_add_00.play();
        }

        let bg_infoglow_a_add: Animation = xNodeFR.findComponent("node_panel/bg_infoglow_a_add", this.node, Animation);
        bg_infoglow_a_add.node.active = bShow;
        if (bShow) {
            bg_infoglow_a_add.play();
        }
    }

    showFreeTitle(bShow) {
        let info_bns2 = xNodeFR.find("bg/info_bns2", this.node);
        info_bns2.active = bShow;
    }


    playAvatarAnim(type) {

        if (type == "triSpecial") { // 触发特殊
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "tease_start", false);
            this._avatarSp.addAnimation(0, "tease_idle", true);
        } else if (type == "triSpecialFail") {    // 触发特殊失败--回到idle
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "tease_start", false);
            this._avatarSp.addAnimation(0, "tease_idle", true);

            let jzSp: sp.Skeleton = xNodeFR.findComponent("scroll_atlas_avatar", this._avatarSp.node, sp.Skeleton);
            jzSp.node.active = true;
            jzSp.setAnimation(0, "tease_start", false);
            jzSp.addAnimation(0, "tease_idle", true);

        } else if (type == "triSpecialFailBack") {
            Tween.stopAllByTarget(this._avatarSp);
            // FRAudioMgr.Instance.playSound("games/COOL");
            let entry = this._avatarSp.setAnimation(0, "tease_exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
            let jzSp: sp.Skeleton = xNodeFR.findComponent("scroll_atlas_avatar", this._avatarSp.node, sp.Skeleton);
            let entry2 = jzSp.setAnimation(0, "tease_exit", false);
            jzSp.setTrackCompleteListener(entry2, () => {
                jzSp.node.active = false;
            })
        } else if (type == "freespin") {
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "freespin", false);
        } else if (type == "respawn") {
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "respawn", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "wildCollect") { // wild图标收集
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "wild_collect", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "winSmall") {    // 小赢
            Tween.stopAllByTarget(this._avatarSp);
            let animName = ["win", "win2"][Math.floor(Math.random() * 2)];
            let entry = this._avatarSp.setAnimation(0, animName, false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "winBig") {  // 大赢
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "win3", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
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

                        let animType = Math.floor(Math.random() * 2) + 2;
                        this._avatarSp.setAnimation(0, "idle" + animType, false);
                        this._avatarSp.addAnimation(0, "idle", true);
                    })
            )
            .start()
    }

    playBgLightAnim(bPlay) {
        let lightAnim: Animation = xNodeFR.findComponent("ui_gate/light", this.node, Animation);
        lightAnim.node.active = bPlay;
        if (bPlay) { lightAnim.play(); }
    }

    // type 1-normal 2-special
    playStartRotateGuang(type) {
        let guang1: Animation = xNodeFR.findComponent("start_spin_guang_kuang", this.node, Animation);
        guang1.play();
        guang1.node.children.forEach((node) => {
            let sprCtrl: FRSpriteCtrl = xNodeFR.findComponent("", node, FRSpriteCtrl);
            if (sprCtrl) {
                sprCtrl.setSpriteIndex(type - 1);
                sprCtrl.node.scale = type == 1 ? new Vec3(1, 1, 1) : new Vec3(1.05, 1.05, 1.05);
            }
        })
    }

    showBgNormal(bNormal = true) {
        xNodeFR.find("bg/fs_bg", this.node).active = !bNormal;
        xNodeFR.find("bg/ui_reel_bg", this.node).active = bNormal;
    }

    roundEnd() {
        frframe.log.logView("round end");

        this.layerCtrl.optCtrl.setAllNum();
        this.layerCtrl.optCtrl.canSendSpin = true;
        FRGameManager.restRound();
        FRGameManager.setAudoNum(FRGameManager.getAudoNum() - 1)
        this.layerCtrl.onPlayFinished();
        this._canCLickMultPanel = true;
    }


    update(dt) {
        if (this._startMove) {
            if (this._minIdleT > 0) {
                this._minIdleT -= dt;
            }

            if (this._minIdleT <= 0 /*&& !this._bStop*/ && this._startLayerCnt == FRConstant.COL_COUNT && this._canStop) {
                this._startMove = false;
                this.cellLayerCtrlList.forEach((layer, col) => {
                    layer.setResultData(FRGameManager.getResultData(col));
                    layer.setDelayT(FRGameManager.getNormalDelayT(col));
                    layer.setStopMove(true);
                });
            }
        }

    }
}