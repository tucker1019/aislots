import { _decorator, Component, instantiate, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { FDConstant, RandomCellType } from '../../FDConstant/FDConstant';
import { IgetCanStop, FDGameManager } from '../../mgr/FDGameManager';
import FDLoadManager from '../../load/FDLoadManager';
import { FDCellItem } from './FDCellItem';
import FDCenterRollCtrl from './FDCenterRollCtrl';
import { fdframe } from '../../../fdframe/fdframe';
import { FDAudioMgr } from './FDAudioMgr';
const { ccclass, property } = _decorator;

@ccclass('FDCellLayer')
export class FDCellLayer extends Component {

    slotsCtrl: FDCenterRollCtrl;
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
        return FDConstant.CELL_SIZE.height * (FDConstant.ROW_COUNT + 3 / 2);
    }
    get bottomY() {
        return -FDConstant.CELL_SIZE.height / 2;
    }
    getTopYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.topY, 0));
    }
    getBottomYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.bottomY, 0));
    }

    init(index: number, slotsCtrl: FDCenterRollCtrl) {
        this.index = index;
        this.slotsCtrl = slotsCtrl;
    }

    creatOne() {
        this.node.removeAllChildren();
        for (let i = 0; i < FDConstant.ROW_COUNT + 2; i++) {  // 上下都余一个
            let type = FDGameManager.getRandomType();
            let prefab = FDLoadManager.ins.getPrefab(FDConstant.PRAFAB_CELL);
            let node = instantiate(prefab);
            node.parent = this.node;
            node.setPosition(new Vec3(0, this.bottomY + i * FDConstant.CELL_SIZE.height, 0));
            node.getComponent(FDCellItem).initTypeView(type, this.slotsCtrl);
            this.allCellList.push(node);
            // node.active = i > 0;
            if (i > 0 && i < FDConstant.ROW_COUNT + 1) {
                this.resultCell[i - 1] = node;
                node.getComponent(FDCellItem).index = (i - 1) * FDConstant.COL_COUNT + this.index;
            }
        }
    }

    setResultData(data) {
        if (data && data.length > 0) {
            this.resultData = data;
        }
      
        for (let i = this.resultData.length; i < FDConstant.ROW_COUNT + 1; i++) {
            this.resultData.push(FDGameManager.getRandomType());
        }

        this._tempResultData = this.resultData.slice(0);
    }

    // 恢复普通节点
    resumeSpecial() {
        this._tempResultData = this.resultData.slice(0);
        let nodelist = this.allCellList.slice(0);
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FDConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FDGameManager.getRandomType();
            nodelist[i].getComponent(FDCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FDCellItem).index = (i - 1) * FDConstant.COL_COUNT + this.index;
                this.resultCell[i - 1] = nodelist[i];
            }
        }
    }

    resData() {
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
        let num1 = 35;
        let rollCnt1 = 0;
        let rollCnt2 = 0;
        for (let i = 0; i < this.allCellList.length; i++) {
            let node = this.allCellList[i];
            let delayT = FDGameManager.getFastAndNoFree() ? 0 : 0.1 * this.index;
            tween(node)
                .delay(delayT)
                .call(() => {
                    // this.allCellList.forEach((node) => { node.active = true });
                    rollCnt1 += 1;
                    if (rollCnt1 == this.allCellList.length) {
                        this.slotsCtrl.playStartRoll(this.index);
                    }
                })
                .by(0.1, { position: new Vec3(0, num1, 0) }, { easing: "quadOut" })
                .by(0.05, { position: new Vec3(0, -num1, 0) })
                .call(() => {
                    rollCnt2 += 1;
                    if (rollCnt2 == this.allCellList.length) {
                        this.oneRoll();
                    }
                })
                .start();
        }
    }

    // 一列滚动
    oneRoll(bStop = false, time = FDGameManager.getRollTime()) {
        // let isFree = FDGameManager.isStateFree();
        let runIndex = 0;
        for (let i = 0; i < this.allCellList.length; i++) {
            let node = this.allCellList[i];
            if (node.position.y <= this.bottomY) {
                node.setPosition(new Vec3(0, this.topY, 0));

                if (bStop) {
                    let type = this._tempResultData.length > 0 ? this._tempResultData.shift() : FDGameManager.getRandomType();
                    node.getComponent(FDCellItem).setTypeView(type);
                    node.getComponent(FDCellItem).index = (this.resultData.length - this._tempResultData.length - 1) * FDConstant.COL_COUNT + this.index;
                    this.resultCell.push(node);
                } else {
                    let type = FDGameManager.getRandomType();
                    node.getComponent(FDCellItem).setTypeView(type, true);
                }
            }

            tween(node)
                .by(time, { position: new Vec3(0, -FDConstant.CELL_SIZE.height, 0) })
                .call(() => {
                    if (runIndex == this.allCellList.length - 1) {
                        if (bStop && this._tempResultData.length == 0) {
                            this.backRoll();
                        } else {
                            if (this._canStop) {
                                if (FDGameManager.getStop()) {    // 手动stop，不再下落，所有cell显示最终的type
                                    this.stopRollClick();
                                }
                                else if (FDGameManager.getFastAndNoFree()) {
                                    this.oneRoll(true)
                                }
                                else {
                                    if (this._tempResultData.length == this.resultData.length) {
                                        this.slotsCtrl.playReadyToStop(this.index);
                                    }
                                    this.oneRoll(true, FDGameManager.getRollTime())
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
        fdframe.log.logView("overSpringBack");

        let num1 = 20;

        this.slotsCtrl.playBackRoll(this.index);

        if (FDGameManager.getStop() || FDGameManager.getFastAndNoFree()) {
            if (this.index == FDConstant.COL_COUNT - 1) {
                FDAudioMgr.Instance.playSound("spinStopQuick");
            }
        } else {
            FDAudioMgr.Instance.playSound("spinStop");
        }


        let stopCnt = 0;
        for (let i = 0; i < this.allCellList.length; i++) {
            // if (FDGameManager.getFastAndNoFree()) {
            //     stopCnt += 1;
            //     if (stopCnt == this.allCellList.length) {
            //         this.stopRoll();
            //     }
            // } else {
            tween(this.allCellList[i]).by(0.04, { position: new Vec3(0, -num1, 0) }).by(0.06, { position: new Vec3(0, num1, 0) })
                .call(() => {
                    stopCnt += 1;
                    if (stopCnt == this.allCellList.length) {
                        this.stopRoll();
                    }
                })
                .start()
            // }

        }
    }

    // 停止转动
    stopRoll() {
        // for (let i = 0; i < FDConstant.ROW_COUNT; i++) {
        //     if (this.resultCell[i] && this.resultCell[i].getComponent(FDCellItem).type == FDConstant.SCATTER_TYPE) {
        //         let cellTop = this.slotsCtrl.copyCellToTop(this.resultCell[i]);
        //         cellTop.getComponent(FDCellItem).playStopAnim();
        //         FDAudioMgr.Instance.playSound("cutwav_7");

        //         // this.slotsCtrl.showScatterBg(true, this.index, i);

        //     }
        // }

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
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FDConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FDGameManager.getRandomType();
            nodelist[i].getComponent(FDCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FDCellItem).index = (i - 1) * FDConstant.COL_COUNT + this.index;
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
                if (FDGameManager.getStop()) {
                    this._canStop = true;
                    this.stopRollClick();
                }
                else if (FDGameManager.getFastAndNoFree()) {
                    this._canStop = true;
                    this.stopRollClick();

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

