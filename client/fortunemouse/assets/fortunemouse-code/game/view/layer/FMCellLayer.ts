import { _decorator, Component, instantiate, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { FMConstant, RandomCellType } from '../../FMConstant/FMConstant';
import { IgetCanStop, FMGameManager } from '../../mgr/FMGameManager';
import FMLoadManager from '../../load/FMLoadManager';
import { FMCellItem } from './FMCellItem';
import FMCenterRollCtrl from './FMCenterRollCtrl';
// import { FMCellBigWild } from './FMCellBigWild';
import { fmframe } from '../../../fmframe/fmframe';
import { FMAudioMgr } from './FMAudioMgr';
import { xNodeFM } from '../../../xtools/xNodeFM';
const { ccclass, property } = _decorator;

@ccclass('FMCellLayer')
export class FMCellLayer extends Component {

    slotsCtrl: FMCenterRollCtrl;
    _index = 0; // 第几列，0开始
    set index(index) {
        this._index = index;
    }
    get index() {
        return this._index;
    }

    allCellList = [];   // 一列所有的cell
    resultData = [];    // 一列最终的type
    _tempResultData = [];  // 复制resultData，用于给每个cell传值
    resultCell = [];    // 停止后牌面上的cell，从下往上，只包含卷轴显示的cell

    _startMove: boolean = false;
    _canStop: boolean = false;
    _remailT: number = -1;
    _bPlayAnti: boolean = false;
    _stopMove = false;

    get topY() {
        return FMConstant.CELL_SIZE.height * (FMConstant.ROW_COUNT + 3 / 2);
    }
    get bottomY() {
        return -FMConstant.CELL_SIZE.height / 2;
    }
    getTopYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.topY, 0));
    }
    getBottomYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.bottomY, 0));
    }

    init(index: number, slotsCtrl: FMCenterRollCtrl) {
        this.index = index;
        this.slotsCtrl = slotsCtrl;
    }

    creatOne() {
        this.node.removeAllChildren();
        for (let i = 0; i < FMConstant.ROW_COUNT + 2; i++) {  // 上下都余一个
            let type = FMGameManager.getRandomType();
            let prefab = FMLoadManager.ins.getPrefab(FMConstant.PRAFAB_CELL);
            let node = instantiate(prefab);
            node.parent = this.node;
            node.setPosition(new Vec3(0, this.bottomY + i * FMConstant.CELL_SIZE.height, 0));
            node.getComponent(FMCellItem).initTypeView(type, this.slotsCtrl);
            this.allCellList.push(node);
            node.active = i > 0;
            if (i > 0) {
                this.resultCell[i - 1] = node;
            }
        }
    }

    showStoredSymbols(symbols: number[]) {
        this.resData();
        this.allCellList.forEach((node, i) => {
            Tween.stopAllByTarget(node);
            node.setPosition(new Vec3(0, this.bottomY + i * FMConstant.CELL_SIZE.height, 0));
            const cell = node.getComponent(FMCellItem);
            cell.setTypeView(i > 0 && i <= symbols.length ? symbols[i - 1] : FMGameManager.getRandomType());
            cell.index = (i - 1) * FMConstant.COL_COUNT + this.index;
            node.active = i > 0;
            if (i > 0) this.resultCell.push(node);
        });
    }

    setResultData(data: number[]) {
        this.resultData = [...data, FMGameManager.getRandomType()];
        this._tempResultData = this.resultData.slice();
    }

    // getTempResultData() {
    //     let _tempResultData = this.resultData.slice(0);
    //     if (FMGameManager.isSpecialGame()) {
    //         let index = FMGameManager.getFreeIndex();
    //         index += 1; // 从-1开始的
    //         if (index > 0) {
    //             // 已经存在的就设为空
    //             let lastData = FMGameManager.getSpecialData(this.index, index - 1);
    //             for (let i = 0; i < lastData.length; i++) {
    //                 if (_tempResultData[i] != 0 && _tempResultData[i] == lastData[i]) {
    //                     _tempResultData[i] = 0;
    //                 }
    //             }
    //         }
    //     }
    //     return _tempResultData;
    // }

    // 恢复普通节点
    resumeSpecial() {
        this._tempResultData = this.resultData.slice(0);
        let nodelist = this.allCellList.slice(0);
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FMConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FMGameManager.getRandomType();
            nodelist[i].getComponent(FMCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FMCellItem).index = (i - 1) * FMConstant.COL_COUNT + this.index;
                this.resultCell[i - 1] = nodelist[i];
            }
        }
    }

    resData() {
        this.unschedule(this.stopRoll);
        this._startMove = false;
        this._canStop = false;
        this._remailT = -1;
        this.resultData = [];
        this.resultCell = [];
        this._tempResultData = [];
        this._stopMove = false;

    }

    setStartMove() {
        if (!this._startMove) {
            this._startMove = true;
            this.startRoll();
        }
    }

    setRemainT(time) {
        this._remailT = time;
    }

    // 开始前有回弹
    startRoll() {
        if (FMGameManager.getFastAndNoFree() || FMGameManager.isSpecialGame()) {
            this.allCellList.forEach((node) => { node.active = true });
            this.oneRoll();
            this.slotsCtrl.playStartRoll(this.index);
        } else {
            let num1 = 35;
            let rollCnt1 = 0;
            let rollCnt2 = 0;
            for (let i = 0; i < this.node.children.length; i++) {
                let node = this.node.children[i];
                tween(node)
                    .delay(0.2 * this.index)
                    .call(() => {
                        this.allCellList.forEach((node) => { node.active = true });
                        rollCnt1 += 1;
                        if (rollCnt1 == this.node.children.length) {
                            this.slotsCtrl.playStartRoll(this.index);
                        }
                    })
                    .by(0.2, { position: new Vec3(0, num1, 0) }, { easing: "quadOut" })
                    .by(0.1, { position: new Vec3(0, -num1, 0) })
                    .call(() => {
                        rollCnt2 += 1;
                        if (rollCnt2 == this.node.children.length) {
                            this.oneRoll();
                        }
                    })
                    .start();
            }
        }
    }

    // 一列滚动
    oneRoll(bStop = false, time = FMGameManager.getRollTime()) {
        // let isFree = FMGameManager.isStateFree();
        let runIndex = 0;
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            if (node.position.y <= this.bottomY + 0.01) {
                node.setPosition(new Vec3(0, this.topY, 0));

                if (bStop) {
                    let type = this._tempResultData.length > 0 ? this._tempResultData.shift() : FMGameManager.getRandomType();
                    node.getComponent(FMCellItem).setTypeView(type);
                    node.getComponent(FMCellItem).index = (this.resultData.length - this._tempResultData.length - 1) * FMConstant.COL_COUNT + this.index;
                    this.resultCell.push(node);
                } else {
                    let type = FMGameManager.getRandomType();
                    node.getComponent(FMCellItem).setTypeView(type, true);
                }
            }

            tween(node)
                .by(time, { position: new Vec3(0, -FMConstant.CELL_SIZE.height, 0) })
                .call(() => {
                    if (runIndex == this.node.children.length - 1) {
                        if (bStop && this._tempResultData.length == 0) {
                            this.backRoll();
                        } else {
                            if (this._canStop) {
                                if (FMGameManager.getStop()) {    // 手动stop，不再下落，所有cell显示最终的type
                                    this.stopRollClick();
                                }
                                else if (FMGameManager.getFastAndNoFree()) {
                                    this.oneRoll(true)
                                }
                                else {
                                    if (this._tempResultData.length == this.resultData.length) {
                                        this.slotsCtrl.playReadyToStop(this.index);
                                    }
                                    let delay2 = (this.resultData.length - this._tempResultData.length) * 0.01 * 2 + 0.01;
                                    if (FMGameManager.isSpecialGame() && this.index == 2) {
                                        delay2 += 0.04
                                    }
                                    this.oneRoll(true, FMGameManager.getRollTime() + delay2)
                                }
                            } else {
                                this.oneRoll()
                            }
                        }
                    }
                    runIndex++;
                })
                .start();
        }
    }

    // 滚动回弹
    backRoll() {
        fmframe.log.logView("overSpringBack");

        let num1 = 30;
        let delay2 = FMGameManager.getRollTime() + (this.resultData.length - this._tempResultData.length) * 0.01 * 2 + 0.01;
        if (FMGameManager.isSpecialGame() && this.index == 2) {
            delay2 += 0.03
        }
        let time2 = num1 / (FMConstant.CELL_SIZE.height / delay2);

        this.slotsCtrl.playBackRoll(this.index);

        let isPlaySpecialEff = false;

        // if (FMGameManager.isSpecialGame()) {
        //     let _tempResultData = this.getTempResultData().slice(0, 3);
        //     if (_tempResultData.findIndex(value => value > 0) >= 0) {
        //         isPlaySpecialEff = true;
        //         FMAudioMgr.Instance.playSound("games/wild");
        //     }
        // }

        if (FMGameManager.getStop() || FMGameManager.getFastAndNoFree()) {
            if (this.index == FMConstant.COL_COUNT - 1) {
                FMAudioMgr.Instance.playSound("games/spinStopQuick");
            }
        } else {
            if (FMGameManager.isSpecialGame()) {
                if (this.index == 0) {
                    FMAudioMgr.Instance.playSound("games/fsReelstop01");
                } else if (this.index == 2) {
                    FMAudioMgr.Instance.playSound("games/fsReelstop02");
                }
            } else {
                FMAudioMgr.Instance.playSound("games/spinStop0" + (this.index + 1));
            }

        }


        const quick = FMGameManager.getFastAndNoFree();
        for (let i = 0; i < this.node.children.length; i++) {
            if (this.node.children[i].position.y < 0 || this.node.children[i].position.y > this.bottomY + (FMConstant.ROW_COUNT + 0.5) * FMConstant.CELL_SIZE.height) {
                this.node.children[i].active = false;
            }
            if (!quick) {
                tween(this.node.children[i])
                    .by(time2, {position: new Vec3(0, -num1, 0)})
                    .by(0.25, {position: new Vec3(0, num1, 0)})
                    .start();
            }
        }
        // Individual cell tweens can finish in different engine ticks. Complete the
        // reel once, after the original rebound duration.
        if (quick) this.stopRoll();
        else this.scheduleOnce(this.stopRoll, time2 + 0.25);
    }

    // 停止转动
    stopRoll() {
        if (!FMGameManager.isSpecialGame()) {
            for (let i = 0; i < FMConstant.ROW_COUNT; i++) {
                if (FMConstant.PRAFAB_LIST[this.resultCell[i].getComponent(FMCellItem).type].stop_anim) {
                    let cellTop = this.slotsCtrl.copyCellToTop(this.resultCell[i]);
                    cellTop.getComponent(FMCellItem).playStopAnim();
                    // this.resultCell[i].active = false;
                }
            }
        }


        this._startMove = false;
        this.slotsCtrl.playStopRoll(this.index);
    }

    // 手动停止
    stopRollClick() {
        // this._tempResultData = this.getTempResultData();
        this._tempResultData = this.resultData.slice(0);

        let nodelist = this.allCellList.slice(0);
        nodelist.sort((a, b) => {
            return a.position.y - b.position.y
        })

        this.resultCell = [];
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FMConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FMGameManager.getRandomType();
            nodelist[i].getComponent(FMCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FMCellItem).index = (i - 1) * FMConstant.COL_COUNT + this.index;
                this.resultCell[i - 1] = nodelist[i];
            }
        }
        this.backRoll();
    }

    setStopMove(bVal) {
        this._stopMove = bVal;
    }

    setDelayT(delayT) {
        this._remailT = delayT;
    }
    addDelayT(delayT) {
        this._remailT += delayT;
        this.resultCell = [];
        this._tempResultData = this.resultData.slice(0);
        this._canStop = false;
    }

    protected update(dt: number): void {
        if (this._startMove) {
            if (this._stopMove && !this._canStop) {
                if (FMGameManager.getStop()) {
                    this._canStop = true;
                    this.stopRollClick();
                }
                else if (FMGameManager.getFastAndNoFree()) {
                    this._canStop = true;
                }
                else {
                    this._remailT -= dt;
                    if (this._remailT <= 0) {
                        this._canStop = true;
                    }
                }
            }

        }
    }
}

