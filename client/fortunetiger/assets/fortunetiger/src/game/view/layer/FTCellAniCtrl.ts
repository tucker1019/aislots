import { _decorator, Component, Node, sp, instantiate } from 'cc';
import { formatStr } from '../../common/FTUtils';
import FTLoadManager from '../../load/FTLoadManager';

const { ccclass, property } = _decorator;

@ccclass('FTCellAniCtrl')

export class FTCellAniCtrl extends Component {

    img_icon: Node
    img_blur: Node

    type

    init(type) {
        this.type = type

        // this.img_icon = this.getNode('img_icon')
        // this.img_blur = this.getNode('img_blur')
        // this.ani_node = this.getNode('ani_node')


        this.img_icon = this.node.getChildByName('img_icon')
        this.img_blur = this.node.getChildByName('img_blur')

        this.reset()
    }

    hideAll() {
        this.img_icon.active = false
        this.img_blur.active = false


        let ani_node = this.node.getChildByName('ani_node')
        if (ani_node) {
            ani_node.active = false
        }

    }

    setAniState() {
        this.hideAll()
        this.playAnim("a2")
    }

    setBlurState() {
        this.hideAll()
        this.img_blur.active = true
    }

    setNormalState() {
        this.hideAll()
        this.img_icon.active = true
    }

    playAnim(name, isLoop = true) {
        this.hideAll()

        let ani_node = this.node.getChildByName('ani_node')
        this.img_icon.active = true
        if (!ani_node) {
            ani_node = this.getTypeByAni(this.type)
            ani_node.parent = this.node
        }
        this.img_icon.active = false // 防止加载动画时空白
        ani_node.active = true
        ani_node.getComponent(sp.Skeleton).setAnimation(0, name, isLoop)
    }

    private getTypeByAni(type): Node {
        let path = formatStr('res/load/prefab/ani/cell%s', type)
        let prefab = FTLoadManager.ins.getPrefab(path);
        let item = instantiate(prefab)
        item.name = "ani_node"
        return item
    }

    reset() {
        this.removeAni()
        this.setNormalState()
    }

    private removeAni() {
        let ani_node = this.node.getChildByName('ani_node')
        if (ani_node) {
            ani_node.parent = null
        }
    }

}

