interface Toggle { active: boolean }
interface Counter { string: string; node?: FooterNode }
interface FooterNode {
    position: { x: number; y: number; z: number };
    setPosition(x: number, y: number, z: number): void;
}
/** 免费阶段替换操作区；次数来自服务端，不随消除或客户端动画自行递减。 */
export class FreePanelView {
    private showing = false;
    private normalBefore = true;
    private menuBefore = false;
    private footerHomes: { x: number; y: number; z: number }[] = [];
    private readonly counterHome?: { x: number; y: number; z: number };
    constructor(private nodes: {
        root: Toggle; normal: Toggle; menu: Toggle;
        remaining: Toggle; last: Toggle; counter: Counter; footer?: FooterNode[];
    }) {
        const position = nodes.counter.node?.position;
        if (position) this.counterHome = { x: position.x, y: position.y, z: position.z };
    }
    setCounterLift(lift: number) {
        const home = this.counterHome;
        if (home) this.nodes.counter.node?.setPosition(home.x, home.y + lift, home.z);
    }
    update(visible: boolean, remaining: number) {
        const n = this.nodes;
        if (visible) {
            if (!this.showing) {
                this.normalBefore = n.normal.active; this.menuBefore = n.menu.active;
                this.footerHomes = (n.footer || []).map(node => ({ x: node.position.x, y: node.position.y, z: node.position.z }));
                // 参考 changeFree：金额栏从 y=54 移到 -110，让免费提示显示在金额栏上方。
                (n.footer || []).forEach((node, i) => {
                    const home = this.footerHomes[i]; node.setPosition(home.x, home.y - 164, home.z);
                });
            }
            n.normal.active = false; n.menu.active = false; n.root.active = true;
            const count = Number.isSafeInteger(remaining) && remaining > 0 ? remaining : 0;
            n.remaining.active = count > 0; n.last.active = count === 0;
            n.counter.string = String(count);
        } else {
            n.root.active = false;
            this.setCounterLift(0);
            if (this.showing) {
                n.normal.active = this.normalBefore; n.menu.active = this.menuBefore;
                (n.footer || []).forEach((node, i) => {
                    const home = this.footerHomes[i]; node.setPosition(home.x, home.y, home.z);
                });
            }
        }
        this.showing = visible;
    }
}
