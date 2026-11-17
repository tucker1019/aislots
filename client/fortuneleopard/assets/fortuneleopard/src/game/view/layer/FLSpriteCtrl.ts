import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FLSpriteCtrl')
export class FLSpriteCtrl extends Component {
    
    @property({type:[SpriteFrame]})
    spList:SpriteFrame[] = []
    
    
    
    setSpriteIndex(idx){
        this.node.getComponent(Sprite).spriteFrame = this.spList[idx];
    }

    
}

