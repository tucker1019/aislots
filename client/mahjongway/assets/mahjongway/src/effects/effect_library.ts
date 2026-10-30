import {
    Animation,
    instantiate,
    Node,
    Prefab,
    resources,
    Sprite,
    UIOpacity,
    Label,
} from 'cc';
import { MWSpriteCtrl } from './MWSpriteCtrl';

const ROOT = 'mahjong_effects/mahjongway/res/';
const NAMES = [
    'cell_win',
    'pop_free_tri',
    'pop_free_again',
    'pop_free_end',
    'big_win',
    'node_anti',
    'bw_particle_a',
    'bw_particle_b',
];
/** 旧场景美术ID→原特效节点。两份工程的图标顺序不同，不能直接拼接编号。 */
export const symbolPaths: Record<number, string> = {
    1: 'symbol_bg/c4',
    2: 'symbol_bg/c1',
    3: 'symbol_bg/c2',
    4: 'symbol_bg/c3',
    5: 'symbol_bg/c7',
    6: 'symbol_bg/c5',
    7: 'symbol_bg/c8',
    8: 'symbol_bg/c6',
    9: 'c10',
    10: 'c9',
};
export class EffectLibrary {
    static prefabs = new Map<string, Prefab>();
    static async load() {
        await Promise.all(
            [...NAMES, 'control_spin', 'control_stop', 'control_turbo'].map(
                async (name) => {
                    const path =
                        name.startsWith('control_')
                            ? 'mahjong_effects/' + name
                            : ROOT + 'load/prefab/games/' + name;
                    const asset = await new Promise<Prefab>((resolve, reject) =>
                        resources.load(path, Prefab, (error, data) =>
                            error ? reject(error) : resolve(data),
                        ),
                    );
                    this.prefabs.set(name, asset);
                },
            ),
        );

    }
    static create(name: string, parent: Node) {
        const prefab = this.prefabs.get(name);
        if (!prefab) throw new Error('特效未加载：' + name);
        const node = instantiate(prefab);
        node.active = false;
        parent.addChild(node);
        return new NativeEffect(node);
    }
}

/** 每个cell持有一个特效实例；重新播放前恢复初始姿态，避免上次动画的缩放/隐藏残留。 */
export class NativeEffect {
    private resetters: Array<() => void> = [];
    constructor(public node: Node) {
        const walk = (n: Node) => {
            const position = n.position.clone(),
                scale = n.scale.clone(),
                rotation = n.eulerAngles.clone(),
                active = n.active;
            const opacity = n.getComponent(UIOpacity),
                alpha = opacity?.opacity;
            const sprite = n.getComponent(Sprite),
                frame = sprite?.spriteFrame,
                enabled = sprite?.enabled,
                color = sprite?.color.clone();
            this.resetters.push(() => {
                n.setPosition(position);
                n.setScale(scale);
                n.setRotationFromEuler(rotation);
                n.active = active;
                if (opacity) opacity.opacity = alpha;
                if (sprite) {
                    sprite.spriteFrame = frame;
                    sprite.enabled = enabled;
                    sprite.color = color;
                }
            });
            n.children.forEach(walk);
        };
        walk(node);
    }
    reset() {
        this.node.getComponentsInChildren(Animation).forEach((animation) => animation.stop());
        this.resetters.forEach((reset) => reset());
        this.node.active = true;
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
    }
    symbol(value: number) {
        const gold = value > 1000,
            symbol = gold ? value - 1000 : value;
        this.node.children.forEach((child) => (child.active = false));
        if (symbol <= 8 || symbol === 11) {
            const bg = this.node.getChildByPath('symbol_bg');
            bg.active = true;
            bg.getComponent(MWSpriteCtrl).setSpriteIndex(gold ? 1 : 0);
            for (let i = 1; i <= 8; i++)
                bg.getChildByName('c' + i).active = symbolPaths[symbol] === 'symbol_bg/c' + i;
            const ingot = bg.getChildByName('gold_ingot');
            if (ingot) ingot.active = gold;
            let extra = bg.getChildByName('three_dots');
            if (symbol === 11 && !extra) {
                extra = new Node('three_dots');
                bg.addChild(extra);
                const label = extra.addComponent(Label);
                label.string = '三饼';
                label.fontSize = 42;
            }
            if (extra) extra.active = symbol === 11;
        } else this.node.getChildByPath(symbolPaths[symbol]).active = true;
    }
    play(name: string, path = '') {
        const node = path ? this.node.getChildByPath(path) : this.node;
        const animation = node?.getComponent(Animation);
        if (!animation?.getState(name)) throw new Error('缺少原生动画：' + name);
        animation.play(name);
        const state = animation.getState(name);
        return state.duration / Math.max(0.001, Math.abs(state.speed));
    }
    loops() {
        this.node.getComponentsInChildren(Animation).forEach((animation) => {
            if (animation.defaultClip) animation.play(animation.defaultClip.name);
        });
    }
    hide() {
        this.node.getComponentsInChildren(Animation).forEach((animation) => animation.stop());
        this.node.active = false;
    }
    destroy() {
        this.node.destroy();
    }
}
