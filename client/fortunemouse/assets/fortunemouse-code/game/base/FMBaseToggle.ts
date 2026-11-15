import { _decorator, Component, Node, Toggle } from 'cc';
import { xNodeFM } from '../../xtools/xNodeFM';

const { ccclass, property } = _decorator;

@ccclass('FMBaseToggle')
export class FMBaseToggle extends Component {
    @property(Node)
    target: Node = null;
    @property(Node)
    checkMark: Node = null;
    @property(Node)
    default: Node = null;

    private isChecked: boolean = true;
    setChecked(isChecked: boolean) {
        this.isChecked = isChecked;
        xNodeFM.setActive("", this.checkMark, isChecked);
        xNodeFM.setActive("", this.default, !isChecked);
    }
    getChecked(): boolean {
        return this.isChecked;
    }
}

