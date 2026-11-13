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
    'big_win',
    'node_anti',
];
const FREE_PREFABS = ['pop_free_again', 'pop_free_end', 'panel_free', 'bonus_bg_particle', 'ui_reel_bonus_dragon', 'dragon', 'mj_fly', 'dragon_mask', 'free_background_skin'];

function loadPrefab(name: string) {
    const path = name.startsWith('pop_') || NAMES.includes(name)
        ? ROOT + 'load/prefab/games/' + name
        : 'mahjong_effects/' + name;
    return new Promise<Prefab>((resolve, reject) =>
        resources.load(path, Prefab, (error, data) => error ? reject(error) : resolve(data)),
    );
}

function reportLoadingProgress(value: number) {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('aislots-loading-progress', { detail: { progress: value } }));
}
/** 旧场景美术ID→原特效节点。两份工程的图标顺序不同，不能直接拼接编号。 */
export const symbolPaths: Record<number, string> = {
    1: 'symbol_bg/c6',
    2: 'symbol_bg/c9',
    3: 'symbol_bg/c8',
    4: 'symbol_bg/c7',
    5: 'symbol_bg/c2',
    6: 'symbol_bg/c5',
    7: 'symbol_bg/c1',
    8: 'symbol_bg/c4',
    9: 'c11',
    10: 'c10',
    11: 'symbol_bg/c3',
};
export class EffectLibrary {
    static prefabs = new Map<string, Prefab>();
    static async load() {
        const names = [...NAMES, 'control_spin', 'control_stop', 'control_turbo', 'control_autostop', 'mult_panel'];
        let loaded = 0;
        reportLoadingProgress(44);
        await Promise.all(
            names.map(
                async (name) => {
                    const asset = await loadPrefab(name);
                    this.prefabs.set(name, asset);
                    loaded++;
                    reportLoadingProgress(44 + Math.round(34 * loaded / names.length));
                },
            ),
        );

    }
    static get freeAssetCount() { return FREE_PREFABS.length; }

    static async loadFree(progress: () => void) {
        const results = await Promise.allSettled(FREE_PREFABS.map(async name => {
            const asset = await loadPrefab(name);
            asset.addRef();
            progress();
            return { name, asset };
        }));
        const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        if (loaded.length !== FREE_PREFABS.length) {
            loaded.forEach(({ asset }) => asset.decRef());
            throw new Error('免费特效加载失败');
        }
        return loaded;
    }

    static create(name: string, parent: Node) {
        const prefab = this.prefabs.get(name);
        if (!prefab) throw new Error('特效未加载：' + name);
        const node = instantiate(prefab);
        node.active = false;
        parent.addChild(node);
        // 格子特效使用宿主格子的局部原点，预制体编辑位置不参与运行时布局。
        if (name === 'cell_win') node.setPosition(0, 0, 0);
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
            for (const child of bg.children)
                child.active = symbolPaths[symbol] === 'symbol_bg/' + child.name;
            const ingot = bg.getChildByName('gold_ingot');
            if (ingot) ingot.active = gold;
        } else {
            const path = symbolPaths[symbol];
            const node = path ? this.node.getChildByPath(path) : null;
            if (!node) throw new Error('AG2 cell_win 缺少图标节点：' + symbol + '/' + path);
            node.active = true;
        }
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
