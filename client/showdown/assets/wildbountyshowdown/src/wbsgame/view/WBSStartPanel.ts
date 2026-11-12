import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WBSStartPanel')
export class WBSStartPanel extends Component {
    _endFunc: Function = null;


    start() {

    }

    setStartFunc(func: Function) {
        this._endFunc = func;
    }

    onCLickPlayBtn() {
        if (this._endFunc) {
            this._endFunc();
            this._endFunc = null;
        }

        this.node.destroy();
    }

}


