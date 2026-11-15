import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { FRGlobal } from '../view/layer/FRGlobal';
const { ccclass, property } = _decorator;

@ccclass('FRCountryManager')
export class FRCountryManager extends Component {
    @property([SpriteFrame])
    sp: SpriteFrame[] = [];
    start() {
        if (FRGlobal.COUNTRYCODE == "IN")
            this.node.getComponent(Sprite).spriteFrame = this.sp[0];
        else if (FRGlobal.COUNTRYCODE == "PH")
            this.node.getComponent(Sprite).spriteFrame = this.sp[1];
        else this.node.getComponent(Sprite).spriteFrame = this.sp[2];
    }

    update(deltaTime: number) {

    }
}

