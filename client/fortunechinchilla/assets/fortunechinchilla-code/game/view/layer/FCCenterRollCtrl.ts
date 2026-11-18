import { _decorator, instantiate, Vec3, tween, find, sp, Label, Node, UIOpacity, UITransform, Sprite, Color, isValid, Prefab, Tween, ParticleSystem2D, bezier, NodeEventType, Animation, math, view, Vec2, UI, } from 'cc';
import { fcframe } from '../../../fcframe/fcframe';
import { xNodeFC } from '../../../xtools/xNodeFC';
import { onceRotateInfo } from '../../3rd/game_1022';
import { FCBaseNode } from '../../base/FCBaseNode';
import { longToNumber, showMoney } from '../../common/FCUtils';

import { FCConstant, FCSTATE, RandomCellType, WINTYPE } from '../../FCConstant/FCConstant';
import FCLoadManager from '../../load/FCLoadManager';
import { FCGameManager, IgetCanStop } from '../../mgr/FCGameManager';
import { FCAudioMgr } from './FCAudioMgr';
import { FCCellItem } from './FCCellItem';
import { FCConfigCtrl } from './FCConfigCtrl';
import { FCGameLayerCtrl } from './FCGameLayerCtrl';
import { FCGlobal } from './FCGlobal';
import { FCLanguage } from './FCLanguage';
import { FCCellLayer } from './FCCellLayer';
import { FCBigWinCtrl } from './FCBigWinCtrl';
import { FCSpriteCtrl } from './FCSpriteCtrl';
import type { Frame } from '../../net/FCResultAdapter';

const { ccclass } = _decorator;

@ccclass('FCCenterRollCtrl')
export default class FCCenterRollCtrl extends FCBaseNode {

    private frame?: Frame;
    private rewardAmounts = new Map<number, number>();
    private cellLayerCtrlList: FCCellLayer[] = [];

    layerCtrl: FCGameLayerCtrl = null;

    _startMove: boolean = false;// 是否开始旋转
    _canStop: boolean = false;// 可以停止
    _bStop: boolean = false;    // 是否已经开始停止
    _stopLayerCnt: number = 0;  //停止旋转的列个数--5列都停了才开始处理停止操作
    _startLayerCnt: number = 0; // 开始旋转的列个数--要等到5列都开始转才能停止
    _minIdleT: number = 0;  // 开始转动的额外空转时间

    _canCLickMultPanel = false; // 是否可以点击图标
    _avatarSp: sp.Skeleton = null;
    _avatarJzSp: sp.Skeleton = null;
    _hasPlayWildStop = false;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FCGameLayerCtrl);
        this._avatarSp = xNodeFC.findComponent("ui_gate/avatar", this.node, sp.Skeleton);
        this._avatarJzSp = xNodeFC.findComponent("ui_gate/avatar/scroll_atlas_avatar", this.node, sp.Skeleton);
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
            let cellLayerCtrl = pNode.addComponent(FCCellLayer);
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
        // FCAudioMgr.Instance.stopSound();
        this.unscheduleAllCallbacks();
        this.hideAllLineMoney();
        this.hideAllLine();
        this.hideAllKuang();
        this.hideAllCellTop();
        this.showSlotsGray(FCGameManager.isHaveBonus());
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.allCellList.forEach(node => {
                node.active = true;
            })
        })
    }

    /**开始转动 */
    public startRotation() {
        fcframe.log.logView("startRotation");
        if (this._startMove) return
        this.unscheduleAllCallbacks();
        if (!FCAudioMgr.Instance.isMusicPlaying()) {
            FCAudioMgr.Instance.playMusic();
        }
        this._canCLickMultPanel = false;

        this.unschedule(this.hideOneMult);
        this.hideOneMult();

        FCGameManager.setStop(false);
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

        if (!FCGameManager.getFast()) {
            this._minIdleT += 0.28;
        } else {
            this._minIdleT += 0.1;
        }
    }

    // 准备停止
    playReadyToStop(index) {

    }

    // 开始滚动回弹
    playBackRoll(index) {
        // if (!this._hasPlayWildStop) {
        //     let data = FCGameManager.getResultData(index)
        //     for (let i = 0; i < FCConstant.ROW_COUNT; i++) {
        //         if (data[i] == FCConstant.WILD_TYPE) {
        //             this._hasPlayWildStop = true;
        //             FCAudioMgr.Instance.playSound("games/wild");
        //         }
        //     }

        // }
    }

    // 停止转动
    playStopRoll(index) {
        this._stopLayerCnt += 1;
        if (this._stopLayerCnt == FCConstant.COL_COUNT) {
            void this.oneRoundEnd().catch(error => this.layerCtrl.handleAnimationError(error));
        }
        // this.hideTriFreeGuang();
    }

    async oneRoundEnd() {
        const frame = this.frame;
        const rotateData = FCGameManager.getRotateData(true);
        if (!frame || !rotateData) return;
        const awardList = rotateData.mAwardList;
        if (frame.mode === 'base') {
            this._canCLickMultPanel = true;
            if (!awardList?.some(award => award.flag_id === 11)) await this.playWildFlyAnim(rotateData.mIcons);
            if (awardList?.length) {
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
                FCAudioMgr.Instance.playSound("games/Special_Win");
                for (let i = 0; i < mIconIdxs.length; i++) {
                    let cellIdx = mIconIdxs[i] - 1;
                    let cellType = mFreeIcons[mIconIdxs[i] - 1];
                    let cellTop = this.playCellToTop(cellIdx, cellType);
                    cellTop.active = true;
                    cellTop.getComponent(FCCellItem).playWinAni(false);
                    this.playKuang(cellIdx, cellType);
                    // this.playFreeNumFly();

                    let numNode = cellTop.getComponent(FCCellItem).getBonusNumNode();
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
                            FCAudioMgr.Instance.playSound("games/WinNum_Fly");
                        })
                        .to(0.5, { position: endPos })
                        .call(() => {
                            FCAudioMgr.Instance.playSound("games/yinjie/scale" + (i + 1));
                            flyNode.destroy();
                            totalWin += win;
                            FCGameManager.setWinMoney(totalWin);
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
                FCGameManager.setRandomList()


                FCAudioMgr.Instance.stopMusic();
                FCAudioMgr.Instance.playMusic();

                await this.delayTime(0.5);


            }
        }

        FCGameManager.setWinMoney(frame.totalWinAmount);
        this.layerCtrl.optCtrl.setAwardNum(frame.totalWinAmount);
        if (frame.nextAction === 'continue') {
            if (frame.triggeredFree && awardList?.length) await this.delayTime(0.6);
            await this.layerCtrl.continuePlay(frame);
            return;
        }
        if (FCGameManager.getAudoNum() > 0) await this.delayTime(0.3);
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
                let type = cell.getComponent(FCCellItem).type;
                let cellTop = this.playCellToTop(idx, type);
                cellTop.active = true;
                cellTop.getComponent(FCCellItem).playWinAni();
                cell.active = false;
                this.playKuang(idx, type);
            }

            if (flag_id > 0 && flag_id !== 11) {
                this.playOneLine(flag_id - 1);
                if (bShowMoney) {
                    this.playOneLineMoney(flag_id - 1, money);
                }
            }

            FCAudioMgr.Instance.playSound("games/Flashing1");
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
            let winType = FCGameManager.getWinType(roundWinMoney, FCGameManager.getTotalBitNum());
            await this.checkBigWin(roundWinMoney);

            if (winType < 3) {
                let effList = [["Yeah", "Hao", "HeiHei", "Aha"], ["ZhenHao", "LiHai"], ["GongXi"]];
                let effName = effList[winType][Math.floor(Math.random() * effList[winType].length)];
                FCAudioMgr.Instance.playSound("games/renwu/" + effName);
                this.playAvatarAnim("winSmall");
            } else {
                this.playAvatarAnim("winBig");
            }

            FCGameManager.setWinMoney(totalWin);
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
            let bitNum = FCGameManager.getTotalBitNum()
            let bigWinType = FCGameManager.getBigWinType(coin, bitNum);
            if (!bigWinType) {
                this.scheduleOnce(() => { resolve() }, noDelayT)
                return
            }

            let endFunc = () => {
                resolve();
            }
            await this.delayTime(0.5);
            let node = xNodeFC.find("Canvas/GameLayer/node_ani/big_win");
            if (!node) {
                let prefab = FCLoadManager.ins.getPrefab("res/load/prefab/games/big_win");
                node = instantiate(prefab);
                node.parent = xNodeFC.find("Canvas/GameLayer/node_ani");
            }
            node.getComponent(FCBigWinCtrl).playBigWin(coin, bigWinType, endFunc);
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
                    if (FCConstant.BONUS_TYPE.indexOf(mIcons[playList[i][j]]) >= 0) {
                        hasPlay = true;
                        bAwait = true;
                        FCAudioMgr.Instance.playSound("games/Particle");

                        let node = FCLoadManager.ins.showGetPrefab("res/load/prefab/games/wild_fly", node_wildFly);
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
                                "onUpdate": (target: Node, radio: number) => {
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
                                FCAudioMgr.Instance.playSound("games/Particle_Fly");
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
        let cell = xNodeFC.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FCLoadManager.ins.getPrefab(FCConstant.PRAFAB_CELL_WIN));
            cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(index));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FCCellItem).initTypeView(type);

        }
        if (cell.getComponent(FCCellItem).type !== type) {
            cell.getComponent(FCCellItem).setTypeView(type);
        }

        return cell
    }
    copyCellToTop(ori_cell) {
        let node_top = this.node.getChildByName("node_top");
        let type = ori_cell.getComponent(FCCellItem).type;
        let index = ori_cell.getComponent(FCCellItem).index;
        let cell = xNodeFC.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FCLoadManager.ins.getPrefab(FCConstant.PRAFAB_CELL_WIN));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FCCellItem).initTypeView(type);

        }
        cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(ori_cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        cell.active = true;
        cell.getComponent(FCCellItem).setTypeView(type);
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
        let node = xNodeFC.find("mask", this.node);
        node && (node.active = bShow);
    }


    // 中线-线动画 flag_id--0开始
    playOneLine(flag_id: number) {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            let line = xNodeFC.find(`line${flag_id + 1}`, node_line);
            // if (!line) {
            //     line = instantiate(FCLoadManager.ins.getPrefab("res/load/prefab/games/win_payline"));
            //     node_line.addChild(line);
            //     line.position = new Vec3(0, ([0, 1, -1][flag_id] || 0) * 183, 0);
            //     line.eulerAngles = new Vec3(0, 0, [0, 0, 0, -45, 45][flag_id]);
            //     line.scale = new Vec3(flag_id < 3 ? 1.7 : 2, 1.7, 0);
            //     line.name = `line${flag_id}`;
            // }
            line.active = true;
        }
        let num_line = xNodeFC.find("ui_gate/payline_win", this.node);
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
        let num_line = xNodeFC.find("ui_gate/payline_win", this.node);
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
        xNodeFC.setLabel("num_info", mask, showMoney(money));
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
            let kuang = xNodeFC.find(`kuang${idx}`, node_kuang);
            if (!kuang) {
                kuang = instantiate(FCLoadManager.ins.getPrefab("res/load/prefab/games/win_kuang"));
                node_kuang.addChild(kuang);
                kuang.position = node_kuang.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(idx));
                kuang.name = `kuang${idx}`;
            }
            kuang.active = true;
            if (type > 10) {
                type = 8
            }
            kuang.getChildByName("ps_vfx_a").getComponent(FCSpriteCtrl).setSpriteIndex(type - 1)

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
        return xNodeFC.find("pos_hb", this._avatarSp.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0))
    }

    /**
     * 
     * @param idx 0开始
     */
    getWorldPosByIdx(idx: number): Vec3 {
        let col = idx % FCConstant.COL_COUNT;
        let row = Math.floor(idx / FCConstant.COL_COUNT);

        let y = FCConstant.CELL_SIZE.height * (row + 1 / 2);
        let pos = this.cellLayerCtrlList[col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return pos
    }

    // idx 0开始
    getCellByIdx(idx: number) {
        let col = idx % FCConstant.COL_COUNT;
        let row = Math.floor(idx / FCConstant.COL_COUNT);
        let node = this.cellLayerCtrlList[col].resultCell[row];
        return node;
    }


    clickMultPanel(event) {
        if (FCGameManager.getAudoNum() > 0) {
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
        } else if (clickPos.x < 107) {
            col = 1;
        } else {
            col = 2;
        }

        let height = FCConstant.CELL_SIZE.height;
        if (col == 1) {
            if (clickPos.y < -height) {
                row = 0;
            } else if (clickPos.y < 0) {
                row = 1;
            } else if (clickPos.y < height) {
                row = 2;
            } else {
                row = 3;
            }
        } else {
            if (clickPos.y < -height / 2) {
                row = 0;
            } else if (clickPos.y < height / 2) {
                row = 1;
            } else {
                row = 2;
            }
        }

        let cellIdx = row * 3 + col;
        let cell = this.getCellByIdx(cellIdx);
        let type = cell.getComponent(FCCellItem).type;
        let refPos = node.getComponent(UITransform).convertToNodeSpaceAR(cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        posX = col > 1 ? refPos.x - 80 : refPos.x + 80;
        posY = refPos.y;

        if (type == 0) {
            return
        }

        let panel = node.getChildByName("mult_panel");
        if (panel && panel.active) {
            panel.active = false;
        }
        if (!panel) {
            panel = instantiate(FCLoadManager.ins.getPrefab("res/load/prefab/games/mult_panel"));
            node.addChild(panel);
            panel.name = "mult_panel";
            panel.on("click", this.onClickMultPanel, this);
        }


        FCAudioMgr.Instance.playSound("games/Icon_Click");
        xNodeFC.find("node_mult/mask", this.node).active = true;
        panel.active = true;
        panel.position = new Vec3(posX, posY, 0)
        panel.getComponent(UITransform).contentSize.height = type == FCConstant.WILD_TYPE ? 240 : 200;
        let num_red = panel.getChildByName("num_red");
        let num_yellow = panel.getChildByName("num_yellow");
        let num_bonus = panel.getChildByName("num_bonus");
        let cell_win = panel.getChildByName("cell_win");
        num_red.active = FCConstant.BONUS_TYPE.indexOf(type) < 0;
        num_yellow.active = FCConstant.BONUS_TYPE.indexOf(type) < 0;
        num_bonus.active = FCConstant.BONUS_TYPE.indexOf(type) >= 0;
        xNodeFC.setLabel("", num_red, "3");
        xNodeFC.setLabel("", num_yellow, "" + FCConstant.PRAFAB_LIST[type].MULT);
        cell_win.children.forEach(node => node.active = false);
        let showSp: sp.Skeleton = xNodeFC.findComponent(FCConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
        if (showSp) {
            showSp.node.active = true;
            showSp.setAnimation(0, FCConstant.PRAFAB_LIST[type].stop_anim, false);
        } else {
            cell_win.getComponent(FCCellItem).initTypeView(type, this);
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
        xNodeFC.find("node_mult/mask", this.node).active = false;
        let mult_panel = xNodeFC.find("node_mult/mult_panel", this.node);
        if (mult_panel) mult_panel.active = false;
    }



    

    playBgAnim() {
        // let bgNode = this.layerCtrl.node;
        // tween(bgNode).to(1.2, { scale: new Vec3(0.9, 0.9, 1) }).start();
        // let bg = xNodeFC.find("Canvas/GameLayer/bg");
        let layout_center = xNodeFC.find("Canvas/GameLayer/layout_center");
        let layout_bottom = xNodeFC.find("Canvas/GameLayer/layout_bottom");
        // let tri_bonus = xNodeFC.find("Canvas/GameLayer/tri_bonus");
        // let ui_bg = xNodeFC.find("Canvas/GameLayer/ui_bg");
        let anim = tween().to(0.8, { scale: new Vec3(0.9, 0.9, 1) })
        // anim.clone(bg).start();
        anim.clone(layout_center).start();
        anim.clone(layout_bottom).start();
        // anim.clone(tri_bonus).start();
        // anim.clone(ui_bg).start();
    }

    recoverToNormal() {
        // FCAudioMgr.Instance.playSound("games/return");           


        // let bgNode = this.layerCtrl.node;
        // tween(bgNode).to(1.2, { scale: new Vec3(1, 1, 1) }).start();
        // let bg = xNodeFC.find("Canvas/GameLayer/bg");
        let layout_center = xNodeFC.find("Canvas/GameLayer/layout_center");
        let layout_bottom = xNodeFC.find("Canvas/GameLayer/layout_bottom");
        // let tri_bonus = xNodeFC.find("Canvas/GameLayer/tri_bonus");
        // let ui_bg = xNodeFC.find("Canvas/GameLayer/ui_bg");
        let reduceAnim = tween().to(0.8, { scale: new Vec3(1, 1, 1) })
        // reduceAnim.clone(bg).start();
        reduceAnim.clone(layout_center).start();
        reduceAnim.clone(layout_bottom).start();
        // reduceAnim.clone(tri_bonus).start();
        // reduceAnim.clone(ui_bg).start();
    }

    playShowBonusYun(bShow, bPlay) {
        let panel_4 = xNodeFC.find("node_panel/panel_4", this.node);
        let panel_4_2 = xNodeFC.find("node_panel/panel_4_2", this.node);
        let panel_5 = xNodeFC.find("node_panel/panel_5", this.node);
        let panel_5_2 = xNodeFC.find("node_panel/panel_5_2", this.node);

        Tween.stopAllByTarget(panel_4);
        Tween.stopAllByTarget(panel_4_2);
        Tween.stopAllByTarget(panel_5);
        Tween.stopAllByTarget(panel_5_2);
        if (bPlay) {
            if (bShow) {
                FCAudioMgr.Instance.playSound("games/Zoom");
                tween(panel_4).call(() => { panel_4.active = true; panel_4.position = new Vec3(-500, 420, 0); }).to(1.2, { position: new Vec3(-410, 420, 0) }).start();
                tween(panel_4_2).call(() => { panel_4_2.active = true; panel_4_2.position = new Vec3(500, 420, 0); }).to(1.2, { position: new Vec3(410, 420, 0) }).start();
                tween(panel_5).call(() => { panel_5.active = true; panel_5.position = new Vec3(-510, -490, 0); }).to(1.2, { position: new Vec3(-373, -490, 0) }).start();
                tween(panel_5_2).call(() => { panel_5_2.active = true; panel_5_2.position = new Vec3(510, -490, 0); }).to(1.2, { position: new Vec3(373, -490, 0) }).start();
            } else {
                FCAudioMgr.Instance.playSound("games/UI_Quit");
                tween(panel_4).to(1.2, { position: new Vec3(-500, 420, 0) }).call(() => { panel_4.active = false; }).start();
                tween(panel_4_2).to(1.2, { position: new Vec3(500, 420, 0) }).call(() => { panel_4_2.active = false; }).start();
                tween(panel_5).to(1.2, { position: new Vec3(-510, -490, 0) }).call(() => { panel_5.active = false; }).start();
                tween(panel_5_2).to(1.2, { position: new Vec3(510, -490, 0) }).call(() => { panel_5_2.active = false; }).start();
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
        FCAudioMgr.Instance.stopMusic();

        let eff1 = ["Special1", "Special2"][Math.floor(Math.random() * 2)];
        FCAudioMgr.Instance.playSound("games/renwu/" + eff1);

        this.playBgAnim();
        this.playShowBonusYun(true, true);

        let fs_vfx_c_screen_opa: UIOpacity = xNodeFC.findComponent("ui_gate/fs_vfx_c_screen", this.node, UIOpacity)
        fs_vfx_c_screen_opa.node.active = true;
        fs_vfx_c_screen_opa.opacity = 0;
        tween(fs_vfx_c_screen_opa)
            .tag(2)
            .repeat(20, tween().to(0.5, { opacity: 255 }).to(0.5, { opacity: 0 }))
            .start()

        let tri_bonus = xNodeFC.find("Canvas/GameLayer/tri_bonus");
        tri_bonus.active = true;
        tri_bonus.children.forEach((node) => {
            node.active = false;
        })

        let guangSp: sp.Skeleton = xNodeFC.findComponent("longmaojitaiedeng", tri_bonus, sp.Skeleton);
        guangSp.node.active = true;
        guangSp.setAnimation(0, "animation", true);

        let logoOpa: UIOpacity = xNodeFC.findComponent("logo", tri_bonus, UIOpacity);
        logoOpa.node.active = true;
        logoOpa.opacity = 0;
        tween(logoOpa)
            .tag(2)
            .repeat(5, tween().to(0.8, { opacity: 190 }).to(0.8, { opacity: 60 }))
            .start();
        tween(logoOpa.node)
            .tag(2)
            .repeat(5, tween().to(0.8, { scale: new Vec3(0.8, 0.8, 1) }).to(0.8, { scale: new Vec3(0.6, 0.6, 1) }))
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
            FCAudioMgr.Instance.playMusic();
        } else {
            // 出现次数弹窗、角色跳到弹窗位置
            FCAudioMgr.Instance.playSound("games/renwu/ZLYZ");
            this.playAvatarAnim("freespin");
            await this.delayTime(0.2);

            FCAudioMgr.Instance.playSound("games/Fireworks");
            Tween.stopAllByTarget(logoOpa);
            logoOpa.node.active = false;

            Tween.stopAllByTarget(fs_vfx_c_screen_opa);
            fs_vfx_c_screen_opa.opacity = 0;

            let bgMask = xNodeFC.find("SpriteSplash", tri_bonus);
            bgMask.active = true;

            let popSp: sp.Skeleton = xNodeFC.findComponent("juanzhoutanc", tri_bonus, sp.Skeleton);
            popSp.node.active = true;
            let fs = xNodeFC.find("juanzhoutanc/fs", tri_bonus);
            fs.active = true;
            popSp.setAnimation(0, "animation", false);
            popSp.setCompleteListener(() => {
                popSp.setCompleteListener(null);
                fs.active = false;
            })

            await this.delayTime(1.8);
            // 弹窗消失、bonus图标加进卷轴动画
            FCAudioMgr.Instance.playMusic("bgm2");
            guangSp.node.active = false;

            let gqSp: sp.Skeleton = xNodeFC.findComponent("tanchuang3-xiaoguo2", tri_bonus, sp.Skeleton);
            gqSp.node.active = true;
            gqSp.setAnimation(0, "5-to-win", false);

            bgMask.active = false;
            this.layerCtrl.optCtrl.initSpecialCnt(freeCnt);

            this.showFreeBgGuangAnim(true);
            this.showFreeTitle(true);
            this.playBgLightAnim(true);

            FCGameManager.setRandomList(RandomCellType.EMPTY)

            let mask = xNodeFC.find("mask", tri_bonus);
            mask.active = true;
            mask.position = tri_bonus.getComponent(UITransform).convertToNodeSpaceAR(this.node.getChildByName("node_item_list").getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)))
            for (let i = 0; i < 10; i++) {
                let cnt = Math.floor(Math.random() * 2) + 1;
                let endCol = [[0, 1], [0, 2], [1, 2]][Math.floor(Math.random() * 3)];
                for (let j = 0; j < cnt; j++) {
                    FCAudioMgr.Instance.playSound("games/Num_Fly");
                    let b_node = instantiate(FCLoadManager.ins.getPrefab(FCConstant.PRAFAB_CELL));
                    b_node.parent = tri_bonus;
                    b_node.position = new Vec3(0, 200, 0);

                    b_node.getComponent(FCCellItem).initTypeView(FCGameManager.getRandonBonusType());
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
                                        this.layerCtrl.optCtrl.updateSpecialCnt(freeCnt - 1)
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

            FCGameManager.setRandomList(RandomCellType.BONUS)


            await this.delayTime(0.8);
        }
    }

    showFreeBgGuangAnim(bShow) {
        let bw_vfx_l_screen_01: Animation = xNodeFC.findComponent("ui_gate/bw_vfx_l_screen_01", this.node, Animation);
        bw_vfx_l_screen_01.node.active = bShow;
        if (bShow) {
            bw_vfx_l_screen_01.play();
        }

        let fs_vfx_b_add_00: Animation = xNodeFC.findComponent("ui_gate/fs_vfx_b_add_00", this.node, Animation);
        fs_vfx_b_add_00.node.active = bShow;
        if (bShow) {
            fs_vfx_b_add_00.play();
        }

        let bg_infoglow_a_add: Animation = xNodeFC.findComponent("node_panel/bg_infoglow_a_add", this.node, Animation);
        bg_infoglow_a_add.node.active = bShow;
        if (bShow) {
            bg_infoglow_a_add.play();
        }
    }

    showFreeTitle(bShow) {
        let info_bns2 = xNodeFC.find("ui_gate/info_bns2", this.node);
        info_bns2.active = bShow;
    }


    playAvatarAnim(type) {

        if (type == "triSpecial") { // 触发特殊
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "tease_start", false);
            this._avatarSp.addAnimation(0, "tease_idle", true);
            this._avatarJzSp.setAnimation(0, "tease_start", false);
            this._avatarJzSp.addAnimation(0, "tease_idle", true);
        } else if (type == "triSpecialFail") {    // 触发特殊失败--回到idle
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "tease_start", false);
            this._avatarSp.addAnimation(0, "tease_idle", true);
            this._avatarJzSp.setAnimation(0, "tease_start", false);
            this._avatarJzSp.addAnimation(0, "tease_idle", true);
        } else if (type == "triSpecialFailBack") {
            Tween.stopAllByTarget(this._avatarSp);
            // FCAudioMgr.Instance.playSound("games/COOL");
            let entry = this._avatarSp.setAnimation(0, "tease_exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
            this._avatarJzSp.setAnimation(0, "tease_exit", false);
        } else if (type == "freespin") {
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "freespin", false);
            this._avatarJzSp.setAnimation(0, "freespin", false);
        } else if (type == "respawn") {
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "respawn", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
            this._avatarJzSp.setAnimation(0, "respawn", false);
        } else if (type == "wildCollect") { // wild图标收集
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "wild_collect", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
            this._avatarJzSp.setAnimation(0, "wild_collect", false);
        } else if (type == "winSmall") {    // 小赢
            Tween.stopAllByTarget(this._avatarSp);
            let animName = ["win", "win2"][Math.floor(Math.random() * 2)];
            let entry = this._avatarSp.setAnimation(0, animName, false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
            this._avatarJzSp.setAnimation(0, animName, false);
        } else if (type == "winBig") {  // 大赢
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "win3", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
            this._avatarJzSp.setAnimation(0, "win3", false);
        }
    }

    playAvatarIdleAnim() {
        Tween.stopAllByTarget(this._avatarSp)
        this._avatarSp.setAnimation(0, "idle", true);
        this._avatarJzSp.setAnimation(0, "idle", true);
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
                        this._avatarJzSp.setAnimation(0, "idle" + animType, false);
                        this._avatarJzSp.addAnimation(0, "idle", true);
                    })
            )
            .start()
    }

    playBgLightAnim(bPlay) {
        let lightAnim: Animation = xNodeFC.findComponent("ui_gate/light", this.node, Animation);
        lightAnim.node.active = bPlay;
        if (bPlay) { lightAnim.play(); }
    }

    // type 1-normal 2-special
    playStartRotateGuang(type) {
        let guang1: Animation = xNodeFC.findComponent("start_spin_guang_kuang", this.node, Animation);
        guang1.play();

        let spr1 = guang1.node.getChildByName("ua_vfx_a_01_add");
        spr1.getComponent(FCSpriteCtrl).setSpriteIndex(type - 1);
        let spr2 = guang1.node.getChildByName("ua_vfx_a_02_add");
        spr2.getComponent(FCSpriteCtrl).setSpriteIndex(type - 1);
        let spr3 = guang1.node.getChildByName("ua_vfx_a_02_add");
        spr3.getComponent(FCSpriteCtrl).setSpriteIndex(type - 1);

        if (type == 1) {
            spr1.position = new Vec3(5, -4, 0);
            spr2.position = new Vec3(-221, -4, 0);
            spr2.scale = new Vec3(1, 1, 1);
            spr3.position = new Vec3(221, -4, 0);
            spr3.scale = new Vec3(1, 1, 1);
        } else if (type == 2) {
            spr1.position = new Vec3(1.08, 1.08, 1.08);
            spr2.position = new Vec3(1.08, 1.08, 1.08);
            spr2.scale = new Vec3(0.9, 1, 1);
            spr3.position = new Vec3(221, -1, 0)
            spr3.scale = new Vec3(0.9, 1, 1);
        }
    }

    showBgNormal(bNormal = true) {
        xNodeFC.find("ui_gate/jitaizhuanpan", this.node).active = bNormal;
        xNodeFC.find("ui_gate/suoxiaojitai", this.node).active = !bNormal;
    }

    roundEnd() {
        fcframe.log.logView("round end");

        this.layerCtrl.optCtrl.setAllNum();
        this.layerCtrl.optCtrl.canSendSpin = true;
        FCGameManager.restRound();
        FCGameManager.setAudoNum(FCGameManager.getAudoNum() - 1)
        this.layerCtrl.onPlayFinished();
        this._canCLickMultPanel = true;
    }
    playGoldFlyAni() {
        return
        let parentNode: Node = xNodeFC.find("window", this.layerCtrl.node)
        let startPos: Vec3 = parentNode.getComponent(UITransform).convertToNodeSpaceAR(this.layerCtrl.optCtrl.lab_award_num.node.getWorldPosition());
        let endPos: Vec3 = parentNode.getComponent(UITransform).convertToNodeSpaceAR(xNodeFC.find("layout_top/node_count/icon", this.layerCtrl.node).getWorldPosition())
        console.log("playGoldFlyAni",startPos,endPos)
        if (startPos && endPos) {
            FCAudioMgr.Instance.playSound("games/coin_fly");
            let info = FCConstant.GOLDFLYCONFIG[2];
            if (FCGameManager.getWinAllMoney() < FCConstant.GOLDFLYCONFIG[0].max) info = FCConstant.GOLDFLYCONFIG[0];
            else if (FCGameManager.getWinAllMoney() < FCConstant.GOLDFLYCONFIG[1].max) info = FCConstant.GOLDFLYCONFIG[1];
            for (let i = 0; i < info.num; i++) {
                let goldFly = instantiate(FCLoadManager.ins.getPrefab("res/load/prefab/games/goldFly"));
             
                xNodeFC.setActive("IN", goldFly, FCGlobal.COUNTRYCODE == "IN")
                xNodeFC.setActive("PH", goldFly, FCGlobal.COUNTRYCODE != "IN")
                parentNode.addChild(goldFly);
                goldFly.setPosition(startPos.x + Math.random() * 60 - 30, startPos.y + Math.random() * 60 - 30);
                goldFly.active = false;
                tween(goldFly)
                    .delay(info.time * i)
                    .call(() => goldFly.active = true)
                    .to(1, { position: endPos }, { easing: "sineIn" })
                    .removeSelf()
                    .start()
            }

        }

    }
    update(dt) {
        if (this._startMove) {
            if (this._minIdleT > 0) {
                this._minIdleT -= dt;
            }

            if (this._minIdleT <= 0 /*&& !this._bStop*/ && this._startLayerCnt == FCConstant.COL_COUNT && this._canStop) {
                FCGameManager.setRoundTime(FCGameManager.getRoundTime() + dt);
                let canStop: IgetCanStop = FCGameManager.getCanStop();
                if (canStop && canStop.state > 0 && this._canStop) {
                    // this._bStop = true;
                    this._startMove = false;
                    if (canStop.state == 1) {
                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            layerCtrl.setResultData(FCGameManager.getResultData(idx));
                            layerCtrl.setDelayT(FCGameManager.getNormalDelayT(idx));
                            layerCtrl.setStopMove(true);
                        })
                    } else {
                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            layerCtrl.setResultData([]);
                            layerCtrl.setDelayT(idx * 0.05 * 5);
                            layerCtrl.setStopMove(true);
                        })
                        this.scheduleOnce(() => {
                            FCLoadManager.ins.showAlertWithInit(FCConfigCtrl.Instance.getLanguageText(FCLanguage.NONET), () => { })
                        }, 1)
                    }
                }
                // }
            }

        }
    }
startSpecialRotation() {
        FCGameManager.specialSpin = true;
        this.resData();
        this.initLight();
        FCGameManager.setState(FCSTATE.RUNNING);
        this.playStartRotateGuang(2);
        this._startMove = true;
        this._minIdleT = 0.75;
        this.cellLayerCtrlList.forEach(layer => layer.setStartMove());
    }

restoreSpecial(remaining: number) {
        this.playBgAnim();
        this.playShowBonusYun(true, false);
        this.showBgNormal(false);
        this.showFreeBgGuangAnim(true);
        this.showFreeTitle(true);
        this.layerCtrl.optCtrl.initSpecialCnt(remaining);
        FCGameManager.setRandomList(RandomCellType.BONUS);
        FCAudioMgr.Instance.stopMusic();
        FCAudioMgr.Instance.playMusic('bgm2');
    }

cancelRoll(icons: number[]) {
        this.resData();
        this.showStoredBoard(icons);
    }

showStoredBoard(icons: number[]) {
        this.initLight();
        this.cellLayerCtrlList.forEach((layer, col) => {
            layer.showStoredSymbols(icons.filter((_, idx) => idx % FCConstant.COL_COUNT === col));
        });
    }

acceptFrame(frame: Frame, rewardAmounts: Map<number, number>) {
        this.frame = frame;
        this.rewardAmounts = rewardAmounts;
        if (frame.mode === 'base' && !frame.triggeredFree && Math.random() < 0.05) {
            this.playAvatarAnim('triSpecialFail');
            void this.triFreeGameAnim(0, true);
        } else this._canStop = true;
    }

}