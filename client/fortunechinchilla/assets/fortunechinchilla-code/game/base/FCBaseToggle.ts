import { _decorator, Component, Node, Toggle } from 'cc';
import { xNodeFC } from '../../xtools/xNodeFC';

const { ccclass, property } = _decorator;

@ccclass('FCBaseToggle')
export class FCBaseToggle extends Component {
    @property(Node)
    target: Node = null;
    @property(Node)
    checkMark: Node = null;
    @property(Node)
    default: Node = null;

    private isChecked: boolean = true;
    setChecked(isChecked: boolean) {
        this.isChecked = isChecked;
        xNodeFC.setActive("", this.checkMark, isChecked);
        xNodeFC.setActive("", this.default, !isChecked);
    }
    getChecked(): boolean {
        return this.isChecked;
    }
}

