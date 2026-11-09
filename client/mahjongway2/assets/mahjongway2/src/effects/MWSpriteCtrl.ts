import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

/** 保留原预制体的序列化 UUID 与图片列表，不引入旧平台或网络模块。 */
@ccclass('MWSpriteCtrl')
export class MWSpriteCtrl extends Component {
    @property([SpriteFrame]) sprList: SpriteFrame[] = [];
    @property([SpriteFrame]) EnSprList: SpriteFrame[] = [];
    @property([SpriteFrame]) PtSprList: SpriteFrame[] = [];

    setSpriteIndex(index: number) {
        const frames = this.sprList.length
            ? this.sprList
            : this.EnSprList.length
              ? this.EnSprList
              : this.PtSprList;
        const sprite = this.getComponent(Sprite);
        if (sprite && frames.length) {
            sprite.spriteFrame = frames[Math.max(0, Math.min(frames.length - 1, index))];
            // 只换图片，不改资源设定的显隐；翻转动画会另画牌底，强制启用会出现双层牌面。
        }
    }
}
