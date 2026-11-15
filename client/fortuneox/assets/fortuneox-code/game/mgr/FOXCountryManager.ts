import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { FOXGlobal } from '../view/layer/FOXGlobal';

const { ccclass, property } = _decorator;

@ccclass('FOXCountryManager')
export class FOXCountryManager extends Component {
    @property([SpriteFrame])
    sp: SpriteFrame[] = [];
    start() {
        this.node.getComponent(Sprite).spriteFrame = FOXGlobal.COUNTRYCODE == "IN" ? this.sp[0] : this.sp[1];
    }

    update(deltaTime: number) {
        
    }
}

