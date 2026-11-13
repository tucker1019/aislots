import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FTSpriteCtrl')
export class FTSpriteCtrl extends Component {
    
    @property({type:[SpriteFrame]})
    spList:SpriteFrame[] = []
    
    
    
    setSpriteIndex(idx){
        this.node.getComponent(Sprite).spriteFrame = this.spList[idx];
    }

    
}

