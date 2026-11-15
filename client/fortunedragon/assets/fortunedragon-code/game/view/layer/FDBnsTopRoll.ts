import { _decorator, Animation, Component, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { xNodeFD } from '../../../xtools/xNodeFD';
import { FDSpriteCtrl } from './FDSpriteCtrl';
import { FDGameManager } from '../../mgr/FDGameManager';
const { ccclass, property } = _decorator;

@ccclass('FDBnsTopRoll')
export class FDBnsTopRoll extends Component {

    allNodeList: Node[] = [];
    singleX: number = 130;
    leftX: number = -260;
    rightX: number = 260;

    resultData: number[] = [];
    _tempResultData: number[] = [];
    resultCell = [];

    _startMove: boolean = false;
    _canStop: boolean = false;
    _remailT: number = -1;
    _stopMove = false;

    start() {

    }

    init() {
        this.singleX = 130;
        this.leftX = -260;
        this.rightX = 260;

        let mask = xNodeFD.find("mask", this.node);
        for (let i = 0; i < mask.children.length; i++) {
            let node = mask.children[i];
            this.allNodeList.push(node);

            node.getComponent(FDSpriteCtrl).sprIndex = this.getRandomType();
            node.position = new Vec3(this.leftX + i * this.singleX, 0)
        }
    }

    playShowWin() {
        let mtp_vfx_b_add = xNodeFD.find("mtp_vfx_b_add", this.node);
        mtp_vfx_b_add.active = true;
        mtp_vfx_b_add.getComponent(Animation).play();
    }

    hideResultCell(idx) {
        this.resultCell[idx].active = false;
    }
    backResultCell(idx) {
        tween(this.resultCell[idx])
            .call(() => { this.resultCell[idx].active = true; this.resultCell[idx].getComponent(UIOpacity).opacity = 150 })
            .start()
    }

    getRandomType() {
        return Math.floor(Math.random() * 3)
    }

    setResultData(data) {
        this.resultData = []
        if (data && data.length > 0) {
            for (let i = 0; i < data.length; i++) {
                this.resultData[i] = FDGameManager.getMulIndex(data[i])
            }
        }
        else {
            this.resultData = Math.random() < 0.5 ? [this.getRandomType(), this.getRandomType()] : [this.getRandomType(), this.getRandomType(), this.getRandomType()]
        }
        this._tempResultData = this.resultData.slice(0);
    }


    resData() {
        this._startMove = false;
        this._canStop = false;
        this._remailT = -1;
        this.resultData = [];
        this._tempResultData = [];
        this.resultCell = [];
        this._stopMove = false;
    }


    setStartMove() {
        if (!this._startMove) {
            this._startMove = true;
            this.allNodeList.forEach(node => {
                node.getComponent(UIOpacity).opacity = 255
            })
            this.oneRoll();
        }
    }

    oneRoll(bStop = false, time = 0.05) {
        let runIndex = 0;
        for (let i = 0; i < this.allNodeList.length; i++) {
            let node = this.allNodeList[i];
            if (node.position.x <= this.leftX) {
                node.setPosition(new Vec3(this.rightX, 0));
                if (bStop) {
                    let type = this._tempResultData.length > 0 ? this._tempResultData.shift() : this.getRandomType();
                    node.getComponent(FDSpriteCtrl).sprIndex = type;
                    if (this.resultCell.length < this.resultData.length) {
                        this.resultCell.push(node)
                    }
                }
                else {
                    let type = this.getRandomType();
                    node.getComponent(FDSpriteCtrl).sprIndex = type;
                }
            }

            tween(node)
                .by(time, { position: new Vec3(-this.singleX, 0), })
                .call(() => {
                    if (runIndex == this.allNodeList.length - 1) {
                        if (bStop && this._tempResultData.length == 0) {
                            this.backRoll();
                        } else {
                            if (this._canStop) {
                                if (FDGameManager.getStop()) {
                                    this.stopRollClick();
                                }
                                else if (FDGameManager.getFastAndNoFree()) {
                                    this.stopRollClick();
                                }
                                else {
                                    this.oneRoll(true)
                                }
                            } else {
                                this.oneRoll()
                            }
                        }
                    }
                    runIndex++;
                })
                .start()
        }
    }

    stopRollClick(notify = true) {
        this._startMove = false;
        this._tempResultData = this.resultData.slice(0);
        let nodelist = this.allNodeList.slice(0);
        nodelist.sort((a, b) => {
            return a.position.x - b.position.x
        })

        this.resultCell = []
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);

            let type;
            if (this.resultData.length == 3) {
                nodelist[i].setPosition(new Vec3(this.leftX + (i + 1) * this.singleX, 0));
                type = this._tempResultData.length > 0 ? this._tempResultData.shift() : this.getRandomType();
                if (this.resultCell.length < this.resultData.length) {
                    this.resultCell.push(nodelist[i])
                }
            } else if (this.resultData.length == 2) {
                nodelist[i].setPosition(new Vec3(this.leftX + (i + 0.5) * this.singleX, 0));
                if (i == 0 || i == nodelist.length - 1) {
                    type = this.getRandomType();
                } else {
                    type = this._tempResultData.length > 0 ? this._tempResultData.shift() : this.getRandomType();
                    if (this.resultCell.length < this.resultData.length) {
                        this.resultCell.push(nodelist[i])
                    }
                }
            }
            nodelist[i].getComponent(FDSpriteCtrl).sprIndex = type;
        }
        if (notify) this.onSettled?.();
    }

    onSettled?: () => void;

    backRoll(time = 0.05) {
        this._startMove = false;
        let settled = 0;
        for (let i = 0; i < this.allNodeList.length; i++) {
            let node = this.allNodeList[i];

            let offX = 0;
            if (this.resultData.length == 3) {
                // offX = this.singleX;
            } else if (this.resultData.length == 2) {
                offX = this.singleX / 2
            }

            tween(node)
                .call(() => {
                    if (node.position.x <= this.leftX) {
                        node.setPosition(new Vec3(this.rightX, 0));
                    }
                })
                .by(time, { position: new Vec3(-offX, 0) })
                .by(0.04, { position: new Vec3(-20, 0) })
                .by(0.04, { position: new Vec3(20, 0) })
                .call(() => { if (++settled === this.allNodeList.length) this.onSettled?.(); })
                .start()

        }

    }

    setStopMove(bVal) {
        this._stopMove = bVal;
    }

    setDelayT(delayT) {
        this._remailT = delayT;
    }
    addDelayT(delayT) {
        this._remailT += delayT;
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


