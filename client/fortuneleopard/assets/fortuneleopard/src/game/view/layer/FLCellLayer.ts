import { _decorator, Component, instantiate, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { FLConstant, RandomCellType } from '../../FLConstant/FLConstant';
import { IgetCanStop, FLGameManager } from '../../mgr/FLGameManager';
import FLLoadManager from '../../load/FLLoadManager';
import { FLCellItem } from './FLCellItem';
import FLCenterRollCtrl from './FLCenterRollCtrl';
// import { FLCellBigWild } from './FLCellBigWild';
import { flframe } from '../../../flframe/flframe';
import { FLAudioMgr } from './FLAudioMgr';
import { xNodeFL } from '../../../xtools/xNodeFL';
const { ccclass, property } = _decorator;

@ccclass('FLCellLayer')
export class FLCellLayer extends Component {

    slotsCtrl: FLCenterRollCtrl;
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
        return FLConstant.CELL_SIZE.height * (FLConstant.ROW_COUNT + 3 / 2);
    }
    get bottomY() {
        return -FLConstant.CELL_SIZE.height / 2;
    }
    getTopYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.topY, 0));
    }
    getBottomYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.bottomY, 0));
    }

    init(index: number, slotsCtrl: FLCenterRollCtrl) {
        this.index = index;
        this.slotsCtrl = slotsCtrl;
    }

    creatOne() {
        this.node.removeAllChildren();
        for (let i = 0; i < FLConstant.ROW_COUNT + 2; i++) {  // 上下都余一个
            let type = FLGameManager.getRandomType();
            let prefab = FLLoadManager.ins.getPrefab(FLConstant.PRAFAB_CELL);
            let node = instantiate(prefab);
            node.parent = this.node;
            node.setPosition(new Vec3(0, this.bottomY + i * FLConstant.CELL_SIZE.height, 0));
            node.getComponent(FLCellItem).initTypeView(type, this.slotsCtrl);
            this.allCellList.push(node);
            node.active = i > 0;
            if (i > 0) {
                this.resultCell[i - 1] = node;
            }
        }
    }

    setResultData(data) {
        if (data && data.length > 0) {
            this.resultData = data;
        }
        else {
            for (let i = 0; i < FLConstant.ROW_COUNT; i++) {
                this.resultData.push(FLGameManager.getRandomType());
            }
        }

        this.resultData.push(FLGameManager.getRandomType());    // 最上面额外多一个
        this._tempResultData = this.getTempResultData();
        // this._tempResultData = this.resultData.slice(0);
        console.log("========this.resultData:", this.resultData)
    }

    getTempResultData() {
        let _tempResultData = this.resultData.slice(0);
        if (FLGameManager.isSpecialGame()) {
            let index = FLGameManager.getFreeIndex();
            index += 1; // 从-1开始的
            if (index > 0) {
                // 已经存在的就设为空
                let lastData = FLGameManager.getSpecialData(this.index, index - 1);
                for (let i = 0; i < lastData.length; i++) {
                    if (_tempResultData[i] != 0 && _tempResultData[i] == lastData[i]) {
                        _tempResultData[i] = 0;
                    }
                }
            }
        }
        return _tempResultData;
    }

    // 恢复普通节点
    resumeSpecial() {
        this._tempResultData = this.resultData.slice(0);
        let nodelist = this.allCellList.slice(0);
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FLConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FLGameManager.getRandomType();
            nodelist[i].getComponent(FLCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FLCellItem).index = (i - 1) * 5 + this.index;
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
        if (FLGameManager.getFastAndNoFree() || FLGameManager.isSpecialGame()) {
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
                    .delay(0.1 * this.index)
                    .call(() => {
                        this.allCellList.forEach((node) => { node.active = true });
                        rollCnt1 += 1;
                        if (rollCnt1 == this.node.children.length) {
                            this.slotsCtrl.playStartRoll(this.index);
                        }
                    })
                    .by(0.1, { position: new Vec3(0, num1, 0) }, { easing: "quadOut" })
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
    oneRoll(bStop = false, time = FLGameManager.getRollTime()) {
        // let isFree = FLGameManager.isStateFree();
        let runIndex = 0;
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            if (node.position.y <= this.bottomY) {
                node.setPosition(new Vec3(0, this.topY, 0));
                if (bStop) {
                    let type = this._tempResultData.length > 0 ? this._tempResultData.shift() : FLGameManager.getRandomType();
                    node.getComponent(FLCellItem).setTypeView(type);
                    node.getComponent(FLCellItem).index = this.resultCell.length * 5 + this.index;
                    this.resultCell.push(node);
                } else {
                    let type = FLGameManager.getRandomType();
                    node.getComponent(FLCellItem).setTypeView(type, true);
                }
            }

            tween(node)
                .by(time, { position: new Vec3(0, -FLConstant.CELL_SIZE.height, 0) })
                .call(() => {
                    if (runIndex == this.node.children.length - 1) {
                        if (bStop && this._tempResultData.length == 0) {
                            this.backRoll();
                        } else {
                            if (this._canStop) {
                                if (FLGameManager.getStop()) {    // 手动stop，不再下落，所有cell显示最终的type
                                    this.stopRollClick();
                                }
                                else if (FLGameManager.getFastAndNoFree()) {
                                    this.oneRoll(true)
                                }
                                else {
                                    if (this._tempResultData.length == this.resultData.length) {
                                        this.slotsCtrl.playReadyToStop(this.index);
                                    }
                                    let delay2 = (this.resultData.length - this._tempResultData.length) * 0.01 * 2 + 0.005;
                                    this.oneRoll(true, FLGameManager.getRollTime() + delay2)
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
        flframe.log.logView("overSpringBack");
        let num1 = 30;
        let delay2 = FLGameManager.getRollTime() + (this.resultData.length - this._tempResultData.length) * 0.01 * 2 + 0.005;
        let time2 = num1 / (FLConstant.CELL_SIZE.height / delay2);
        let backAni = tween().by(time2, { position: new Vec3(0, -num1, 0) }).by(0.24, { position: new Vec3(0, num1, 0) });

        this.slotsCtrl.playBackRoll(this.index);

        let isPlaySpecialEff = false;

        if (FLGameManager.isSpecialGame()) {
            let _tempResultData = this.getTempResultData().slice(0, 3);
            if (_tempResultData.findIndex(value => value > 0) >= 0) {
                isPlaySpecialEff = true;
                FLAudioMgr.Instance.playSound("games/wild");
            }
        }

        if (FLGameManager.getStop() || FLGameManager.getFastAndNoFree()) {
            if (this.index == FLConstant.COL_COUNT - 1) {
                FLAudioMgr.Instance.playSound("games/SymbolFallDown3");
            }
        } else {
            FLAudioMgr.Instance.playSound("games/SymbolFallDown3");
        }

        const visible = this.node.children.filter(node => {
            if (node.position.y < 0) node.active = false;
            return node.active;
        });
        if (FLGameManager.getFastAndNoFree() || visible.length === 0) {
            this.stopRoll();
            return;
        }
        // Cocos 3.8.5 pauses tweens on inactive nodes. The hidden buffer
        // must not be part of the reel's rebound completion barrier.
        let remaining = visible.length;
        for (const node of visible) {
            backAni.clone(node)
                .call(() => {
                    if (--remaining === 0) this.stopRoll();
                })
                .start();
        }
    }

    // 停止转动
    stopRoll() {
        this._startMove = false;
        this.slotsCtrl.playStopRoll(this.index);
    }

    // 手动停止
    stopRollClick() {
        this._tempResultData = this.getTempResultData();
        // this._tempResultData = this.resultData.slice(0);

        let nodelist = this.allCellList.slice(0);
        nodelist.sort((a, b) => {
            return a.position.y - b.position.y
        })

        this.resultCell = [];
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FLConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FLGameManager.getRandomType();
            nodelist[i].getComponent(FLCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FLCellItem).index = (i - 1) * 5 + this.index;
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
                if (FLGameManager.getStop()) {
                    this._canStop = true;
                    this.stopRollClick();
                }
                else if (FLGameManager.getFastAndNoFree()) {
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

