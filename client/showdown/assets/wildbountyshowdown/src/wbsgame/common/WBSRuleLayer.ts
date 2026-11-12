import { _decorator, Component, isValid, Label, Node, tween, Vec3 } from "cc";
import { WBSConstant } from "../../../src/wbsgame/constant/WBSConstant";
import { wbsgame } from "../wbsgame";

const { ccclass, property } = _decorator;

@ccclass('WBSRuleLayer')
export class WBSRuleLayer extends Component {
    @property(Node)
    aniNode: Node = null;

    protected onLoad(): void {

        if (!isValid(this.aniNode)) return;
    }

    start() {
    }


    onBtnClose() {
        if (this.node && this.node.isValid)
            this.node.destroy();
    }

}

