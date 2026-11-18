import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { FCGlobal } from '../view/layer/FCGlobal';
const { ccclass, property } = _decorator;

@ccclass('FCCountryManager')
export class FCCountryManager extends Component {
    @property([SpriteFrame])
    sp: SpriteFrame[] = [];
    start() {
        this.node.getComponent(Sprite).spriteFrame = FCGlobal.COUNTRYCODE == "IN" ? this.sp[0] : this.sp[1];
    }

    update(deltaTime: number) {

    }
}

