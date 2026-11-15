import { _decorator, Component, Node, Toggle } from 'cc';
import { xNodeFD } from '../../xtools/xNodeFD';

const { ccclass, property } = _decorator;

@ccclass('FDBaseToggle')
export class FDBaseToggle extends Component {
    @property(Node)
    target: Node = null;
    @property(Node)
    checkMark: Node = null;
    @property(Node)
    default: Node = null;

    private isChecked: boolean = true;
    setChecked(isChecked: boolean) {
        this.isChecked = isChecked;
        xNodeFD.setActive("", this.checkMark, isChecked);
        xNodeFD.setActive("", this.default, !isChecked);
    }
    getChecked(): boolean {
        return this.isChecked;
    }
}

