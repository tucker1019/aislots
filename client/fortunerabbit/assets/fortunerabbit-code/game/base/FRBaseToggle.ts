import { _decorator, Component, Node, Toggle } from 'cc';
import { xNodeFR } from '../../xtools/xNodeFR';

const { ccclass, property } = _decorator;

@ccclass('FRBaseToggle')
export class FRBaseToggle extends Component {
    @property(Node)
    target: Node = null;
    @property(Node)
    checkMark: Node = null;
    @property(Node)
    default: Node = null;

    private isChecked: boolean = true;
    setChecked(isChecked: boolean) {
        this.isChecked = isChecked;
        xNodeFR.setActive("", this.checkMark, isChecked);
        xNodeFR.setActive("", this.default, !isChecked);
    }
    getChecked(): boolean {
        return this.isChecked;
    }
}

