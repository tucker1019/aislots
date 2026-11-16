import { _decorator, Component, Color, Sprite, UITransform, Vec3, tween, Node, } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FTShowAwardAni')
export class FTShowAwardAni extends Component {

    @property(Node)
    private aniNode: Node = null!

    onLoad() {
        this.aniRun();
    }

    start() {

    }

    setNodeColor(isRed: boolean = false) {
        if (!this.node || !this.aniNode) {
            return
        }
        let greenColor = new Color(0, 255, 0, 80)
        let redColor = new Color(255, 0, 0, 80)
        if (isRed) {
            this.aniNode.getComponent(Sprite).color = redColor
        } else {
            this.aniNode.getComponent(Sprite).color = greenColor
        }
    }

    aniRun() {
        let node = this.aniNode.getChildByName("aniNode")
        let pNode = this.node.parent;
        let h = pNode.getComponent(UITransform).height
        this.aniNode.getComponent(UITransform).height = h
        node.getComponent(UITransform).height = h
        let startY = h / 2;
        this.aniNode.position = new Vec3(0, startY, 0);
        this.nodeRoll(h)
    }

    nodeRoll(h) {
        tween(this.aniNode)
            .by(0.5, { position: new Vec3(0, -2 * h, 0) })
            .call(() => {
                this.aniNode.position = new Vec3(0, h / 2, 0);
                this.nodeRoll(h);
            })
            .start()
    }


    update(deltaTime: number) {

    }
}

