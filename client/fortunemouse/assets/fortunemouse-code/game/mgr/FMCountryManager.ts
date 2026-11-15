import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { FMGlobal } from '../view/layer/FMGlobal';

const { ccclass, property } = _decorator;

@ccclass('FMCountryManager')
export class FMCountryManager extends Component {
    @property([SpriteFrame])
    sp: SpriteFrame[] = [];
    start() {
        if (FMGlobal.COUNTRYCODE == "IN")
            this.node.getComponent(Sprite).spriteFrame = this.sp[0];
        else if (FMGlobal.COUNTRYCODE == "PH")
            this.node.getComponent(Sprite).spriteFrame = this.sp[1];
        else this.node.getComponent(Sprite).spriteFrame = this.sp[2];
    }

    update(deltaTime: number) {

    }
}

