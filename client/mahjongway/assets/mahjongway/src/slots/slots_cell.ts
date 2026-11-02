import { WinAnimationEvents } from '../effects/win_animation_events';
import { EffectLibrary, NativeEffect } from '../effects/effect_library';
import { _decorator, Component, Node, EventTouch, Animation, UIOpacity, UITransform, Label, Color } from 'cc';
import { slots_base } from './slots_base';
import { printDebug } from '../com/utils';
const { ccclass, property } = _decorator;

@ccclass('slots_cell')
export class slots_cell extends Component {
    @property(Node)
    symbol: Node = null;
    @property(Node)
    blur: Node = null;
    @property([Node])
    symbol_cells: Node[] = [];
    @property([Node])
    blur_cells: Node[] = [];
    @property([Node])
    blur_bg: Node[] = [];
    @property([Node])
    symbol_bg: Node[] = [];
    slots_base: slots_base = null;

    b_blur: boolean = true;
    v_value: number = -1;
    private _displaySymbol: number = 0;
    private _displayGold: boolean = null;
    private _displayNormalBg: boolean = null;
    protected onLoad(): void {
        this.slots_base = this.node.parent.parent.getComponent(slots_base);
        // 旧 cell 根节点只有脚本；触摸节点必须有 UITransform，否则 Cocos 无法排序事件。
        if (!this.node.getComponent(UITransform)) this.node.addComponent(UITransform).setContentSize(150,165);
        this.node.on(Node.EventType.TOUCH_END, this.inspectSymbol, this);
    }
    private inspectSymbol(event: EventTouch) {
        if (this.slots_base.showSymbolTooltip(this.node, this.v_value)) event.propagationStopped = true;
    }
    protected onDestroy() { this.node.off(Node.EventType.TOUCH_END, this.inspectSymbol, this); }
    private effect: NativeEffect = null;
    private winning = false;
    private winAnchor: Node = null;
    private stopFinished: () => void = null;
    get isAwardPlaying() {
        return this.winning;
    }

    /** cell及其原生特效节点均复用，消除结束后只隐藏，不销毁。 */
    refreshEffect() {
        if (this.winning) return;
        this.cancelStopAnimation();
        const symbol = this.v_value > 1000 ? this.v_value - 1000 : this.v_value;
        if (
            !this.b_blur &&
            (symbol === 9 || symbol === 10) &&
            EffectLibrary.prefabs.has('cell_win')
        ) {
            this.effect = this.effect || EffectLibrary.create('cell_win', this.node);
            this.effect.reset();
            this.effect.symbol(this.v_value);
            this.effect.play(symbol === 9 ? 'cell_idle_sca' : 'cell_idle_wild');
            this.symbol.active = false;
            this.blur.active = false;
        } else {
            this.effect?.hide();
            this.symbol.active = !this.b_blur;
            this.blur.active = this.b_blur;
        }
    }

    private cancelStopAnimation() {
        if (this.stopFinished && this.effect) {
            this.effect.node
                .getComponent(Animation)
                .off(Animation.EventType.FINISHED, this.stopFinished);
            this.stopFinished = null;
        }
    }
    /** Scatter停轴时播放原始闪光，结束后恢复待机循环。 */
    playScatterStop() {
        if (this.v_value !== 9 || this.b_blur || this.winning) return;
        this.refreshEffect();
        if (!this.effect) return;
        const animation = this.effect.node.getComponent(Animation);
        this.stopFinished = () => {
            this.stopFinished = null;
            if (!this.winning) this.effect.play('cell_idle_sca');
        };
        animation.once(Animation.EventType.FINISHED, this.stopFinished);
        this.effect.play('cell_stop_sca');
    }

    playWin(transforms: boolean, effectLayer?: Node) {
        this.cancelStopAnimation();
        this.winning = false;
        this.effect = this.effect || EffectLibrary.create('cell_win', this.node);
        this.effect.reset();
        this.effect.symbol(this.v_value);
        if (effectLayer) {
            // 锚点保持格子的世界位置，动画仍在自身局部坐标中播放。
            if (!this.winAnchor) {
                this.winAnchor = new Node('cell_win_anchor');
                this.winAnchor.layer = this.node.layer;
            }
            this.winAnchor.parent = effectLayer;
            this.winAnchor.setWorldPosition(this.node.worldPosition);
            this.winAnchor.setWorldScale(this.node.worldScale);
            this.winAnchor.setWorldRotation(this.node.worldRotation);
            this.effect.node.setParent(this.winAnchor, false);
        }
        this.symbol.active = false;
        this.blur.active = false;
        this.winning = true;
        const events = this.effect.node.getComponent(WinAnimationEvents)
            || this.effect.node.addComponent(WinAnimationEvents);
        events.onHighlightEnd = () => this.slots_base.endAwardHighlight();
        const animation = this.effect.node.getComponent(Animation);
        const finished = () => {
            animation.off(Animation.EventType.FINISHED, finished);
            this.winning = false;
            events.onHighlightEnd = null;
            this.effect.hide();
            this.effect.node.setParent(this.node, false);
            if (transforms) {
                this.setCellValue(10);
                this.refreshEffect();
            } else this.node.active = false;
        };
        animation.once(Animation.EventType.FINISHED, finished);
        this.effect.play(
            transforms
                ? 'cell_win_mj_to_wild'
                : this.v_value === 10
                  ? 'cell_win_wild'
                  : 'cell_win_mj',
        );
    }

    /** 黑底撤掉后恢复原格子绘制顺序，翻转牌不再跨层压住相邻牌边。 */
    restoreWinLayer() {
        if (this.winning && this.effect && this.effect.node.parent !== this.node) {
            this.effect.node.setParent(this.node, false);
        }
    }

    setBlur(blur: boolean) {
        if (this.b_blur === blur) {
            return;
        }
        this.blur.active = blur;
        this.symbol.active = !blur;
        this.b_blur = blur;
        this._displaySymbol = 0;
        this._displayGold = null;
        this._displayNormalBg = null;
        if (this.v_value >= 0) {
            this.applyDisplay(this.v_value);
            this.refreshEffect();
        }
    }
    private extra: Node = null;
    /** 复用被消除隐藏的节点时，先恢复显示和透明度，再更新图标。 */
    setCellValue(value: number) {
        this.node.active = value > 0;
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
        if (this.v_value === value) {
            this.refreshEffect();
            return;
        }
        this.v_value = value;
        this.applyDisplay(value);
        this.refreshEffect();
    }
    // 场景静态图标与滚动模糊图分别缓存；这里只切换显示，不参与服务端中奖计算。
    private applyDisplay(value: number) {
        if (value <= 0) {
            printDebug('applyDisplay value <= 0', value);
            return;
        }
        const isgold = value > 1000;
        const symbol = isgold ? value - 1000 : value;
        if (symbol === 11 && !this.extra) {
            this.extra = new Node('symbol_three_dots');
            this.symbol.addChild(this.extra);
            const label = this.extra.addComponent(Label);
            label.string = '三饼';
            label.fontSize = 42;
            label.color = new Color(56, 123, 84);
        }
        if (this.extra) this.extra.active = symbol === 11;
        const symbols = this.b_blur ? this.blur_cells : this.symbol_cells;
        if (this._displaySymbol !== symbol) {
            if (this._displaySymbol > 0) {
                if (symbols[this._displaySymbol - 1])
                    symbols[this._displaySymbol - 1].active = false;
                if (symbols[symbol - 1]) symbols[symbol - 1].active = true;
            } else {
                for (let i = 0; i < symbols.length; i++) {
                    symbols[i].active = i + 1 === symbol;
                }
            }
            this._displaySymbol = symbol;
        }
        const showNormalBg = (symbol <= 8 || symbol === 11) && !isgold;
        if (this._displayGold !== isgold || this._displayNormalBg !== showNormalBg) {
            const bg = this.b_blur ? this.blur_bg : this.symbol_bg;
            bg[0].active = showNormalBg;
            bg[1].active = isgold;
            this._displayGold = isgold;
            this._displayNormalBg = showNormalBg;
        }
    }
}
