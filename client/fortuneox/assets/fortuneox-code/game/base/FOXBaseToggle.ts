import { _decorator, Component, Node, Toggle } from 'cc';
import { xNodeFOX } from '../../xtools/xNodeFOX';

const { ccclass, property } = _decorator;

@ccclass('FOXBaseToggle')
export class FOXBaseToggle extends Component {
    @property(Node)
    target: Node = null;
    @property(Node)
    checkMark: Node = null;
    @property(Node)
    default: Node = null;

    private isChecked: boolean = true;
    setChecked(isChecked: boolean) {
        this.isChecked = isChecked;
        xNodeFOX.setActive("", this.checkMark, isChecked);
        xNodeFOX.setActive("", this.default, !isChecked);
    }
    getChecked(): boolean {
        return this.isChecked;
    }
}

