import { _decorator, Component, Node, Toggle } from 'cc';
import { xNodeFT } from '../../xtools/xNodeFT';

const { ccclass, property } = _decorator;

@ccclass('FTBaseToggle')
export class FTBaseToggle extends Component {
    @property(Node)
    target: Node = null;
    @property(Node)
    checkMark: Node = null;
    @property(Node)
    default: Node = null;

    private isChecked: boolean = true;
    setChecked(isChecked: boolean) {
        this.isChecked = isChecked;
        xNodeFT.setActive("", this.checkMark, isChecked);
        xNodeFT.setActive("", this.default, !isChecked);
    }
    getChecked(): boolean {
        return this.isChecked;
    }
}

