import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

/** 由中奖片段的黄框结束事件通知演出层，不依赖固定墙钟时间。 */
@ccclass('WinAnimationEvents')
export class WinAnimationEvents extends Component {
    onHighlightEnd: (() => void) | null = null;

    onAwardHighlightEnd() {
        this.onHighlightEnd?.();
    }
}
