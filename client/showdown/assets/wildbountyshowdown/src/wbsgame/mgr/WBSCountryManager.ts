import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { WBSConfig } from '../cfg/WBSConfig';
const { ccclass, property } = _decorator;

@ccclass('WBSountryManager')
export class WBSountryManager extends Component {
    @property([SpriteFrame])
    sp: SpriteFrame[] = [];
    start() {
        if (WBSConfig.COUNTRYCODE == "IN")
            this.node.getComponent(Sprite).spriteFrame = this.sp[0];
        else if (WBSConfig.COUNTRYCODE == "PH")
            this.node.getComponent(Sprite).spriteFrame = this.sp[1];
        else this.node.getComponent(Sprite).spriteFrame = this.sp[2];
    }

    update(deltaTime: number) {

    }
}

