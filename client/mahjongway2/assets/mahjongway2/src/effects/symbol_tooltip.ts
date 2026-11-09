import { Node, Label, UITransform, Graphics, Color, Sprite, EventTouch } from 'cc';
import { EffectLibrary, NativeEffect } from './effect_library';
import { symbolTip, tipPosition } from './symbol_tip_model';
/** 缓存一个原生赔率浮层；静止时点击图标查看，5秒、点外部或开始旋转时关闭。 */
export class SymbolTooltip {
    private layer: Node;
    private panel: NativeEffect;
    private sample: NativeEffect;
    private age = 0;
    constructor(private board: Node, private sound: () => void) {
        this.layer = new Node('symbol_tooltip_layer'); this.layer.layer = board.layer;
        board.addChild(this.layer); this.layer.active = false;
        const shade = new Node('SpriteSplash'); shade.layer = board.layer; this.layer.addChild(shade);
        shade.addComponent(UITransform).setContentSize(720, 990);
        const graphics = shade.addComponent(Graphics); graphics.fillColor = new Color(0, 0, 0, 90);
        graphics.rect(-360, -506.5, 720, 990); graphics.fill();
        // 遮罩只绘制，不截获图标触摸；点击其他图标可直接切换说明。
        this.board.parent.on(Node.EventType.TOUCH_END, this.hide, this);
    }
    show(cell: Node, value: number, column: number) {
        if (!this.panel) {
            this.panel = EffectLibrary.create('mult_panel', this.layer);
            this.panel.node.on(Node.EventType.TOUCH_END, this.closeFromPanel, this);
            this.sample = EffectLibrary.create('cell_win', this.panel.node);
        }
        this.panel.reset(); this.layer.active = true; this.age = 0;
        this.layer.setSiblingIndex(this.board.children.length - 1);
        const details = symbolTip(value), special = !details.payout;
        const position = this.board.getComponent(UITransform).convertToNodeSpaceAR(cell.worldPosition);
        const layout = tipPosition(position.x, position.y, column, special);
        const root = this.panel.node, labels = root.getChildByName('labels'), other = root.getChildByName('other');
        root.setPosition(layout.x, layout.y); root.getComponent(UITransform).setContentSize(layout.width, 175);
        labels.active = !special; other.active = special;
        if (details.payout) [1, 2, 3].forEach((n, index) => labels.getChildByName('label' + n).getComponent(Label).string = String(details.payout[2 - index]));
        if (special) { const label = other.getComponent(Label); label.string = details.description; label.fontSize = 24; }
        labels.setPosition(layout.direction * 82, 0);
        other.setPosition(layout.direction * 75, 0);
        this.sample.reset(); this.sample.symbol(value);
        // cell_win 的普通牌底默认由消除动画启用；静态说明中需要显式显示。
        const background = this.sample.node.getChildByName('symbol_bg')?.getComponent(Sprite);
        if (background) background.enabled = true;
        const native = value > 1000 ? value - 1000 : value;
        this.sample.node.setPosition(-layout.direction * layout.gap, 0);
        if (native === 9 || native === 10) this.sample.play(native === 9 ? 'cell_idle_sca' : 'cell_idle_wild');
        this.sound();
    }
    private closeFromPanel(event: EventTouch) { event.propagationStopped = true; this.hide(); }
    hide() { this.layer.active = false; }
    update(dt: number, allowed: boolean) {
        if (!allowed) this.hide();
        if (this.layer.active) { this.age += dt; if (this.age >= 5) this.hide(); }
    }
    destroy() {
        this.board.parent.off(Node.EventType.TOUCH_END, this.hide, this);
        this.panel?.node.off(Node.EventType.TOUCH_END, this.closeFromPanel, this);
        this.layer.destroy();
    }
}
