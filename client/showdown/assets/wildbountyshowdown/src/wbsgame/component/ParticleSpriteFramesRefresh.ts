

import { _decorator, Component, SpriteAtlas, CCInteger, SpriteFrame, macro, ParticleSystem2D } from "cc"
import { cloneArray } from "../../xtools/WBSUtils";
const { ccclass, property } = _decorator;
/**
 * 实现功能：粒子节点，动态替换图集中精灵贴图
 */
@ccclass
export default class ParticleSpriteFramesRefresh extends Component {


    @property({ type: SpriteAtlas, tooltip: "图集资源" })
    private atlas: SpriteAtlas = null;

    @property({ type: [SpriteFrame], tooltip: "贴图资源" })
    private spriteFrameList: SpriteFrame[] = [];

    @property({ type: CCInteger, tooltip: "每秒替换粒子贴图多少次" })
    private aniFps: number = 15;

    private ps: ParticleSystem2D = null;

    private index = 0;
    private count = 0;
    /**图集序列帧集合 */
    private spriteArray: SpriteFrame[] = [];
    protected onLoad(): void {

        this.ps = this.node.getComponent(ParticleSystem2D);
        if (this.atlas) {
            this.spriteArray = this.atlas.getSpriteFrames();
        } else {
            this.spriteArray = cloneArray(this.spriteFrameList);
        }

        this.count = this.spriteArray.length;
        this.schedule(this.refreshSprite, 1 / this.aniFps, macro.REPEAT_FOREVER);
    }

    private refreshSprite() {
        if (this.index >= this.count)
            this.index = 0;
        this.ps.spriteFrame = this.spriteArray[this.index];
        this.index++;
    }
}
