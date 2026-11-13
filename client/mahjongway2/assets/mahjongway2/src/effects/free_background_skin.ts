import { Node, Sprite } from 'cc';
import type { NativeEffect } from './effect_library';

/** Free-only art is prepared with the trigger page, never by the launch scene. */
export class FreeBackgroundSkin {
    private showing = false;
    private bindings: { sprite: Sprite; free: Sprite['spriteFrame']; normal?: Sprite['spriteFrame'] }[] = [];
    private edges: { node: Node; created: boolean; free: Sprite['spriteFrame']; position: Node['position']; home?: Node['position']; active?: boolean; normal?: Sprite['spriteFrame'] }[] = [];

    constructor(root: Node, private artwork: NativeEffect) {
        const find = (node: Node, name: string): Node | null => {
            if (node === artwork.node) return null;
            if (node.name === name) return node;
            for (const child of node.children) { const result = find(child, name); if (result) return result; }
            return null;
        };
        for (const name of ['reel_a', 'ui_bg_a', 'ui_bg_b', 'ui_bg_c', 'ui_footer']) {
            const sprite = find(root, name)?.getComponent(Sprite);
            const free = artwork.node.getChildByName(name)?.getComponent(Sprite)?.spriteFrame;
            if (!sprite || !free) throw new Error('免费背景缺少配置：' + name);
            this.bindings.push({ sprite, free });
        }
        const info = find(root, 'ib_bar');
        if (!info) throw new Error('免费背景缺少提示条');
        for (const name of ['infoboard_lv01_mask', 'infoboard_lv01_mask-001']) {
            const template = artwork.node.getChildByName(name);
            if (!template) throw new Error('免费提示条缺少遮边：' + name);
            const existing = info.getChildByName(name);
            const node = existing || template;
            const position = { ...template.position } as Node['position'];
            const free = template.getComponent(Sprite).spriteFrame;
            if (!existing) { node.parent = info; node.active = false; }
            this.edges.push({ node, created: !existing, free, position });
        }
    }

    update(free: boolean) {
        if (this.showing === free) return;
        for (const binding of this.bindings) {
            if (free) binding.normal = binding.sprite.spriteFrame;
            binding.sprite.spriteFrame = free ? binding.free : binding.normal;
        }
        for (const edge of this.edges) {
            const sprite = edge.node.getComponent(Sprite);
            if (free) {
                edge.home = { ...edge.node.position } as Node['position'];
                edge.active = edge.node.active;
                edge.normal = sprite.spriteFrame;
                sprite.spriteFrame = edge.free;
                edge.node.setPosition(edge.position);
                edge.node.active = true;
            } else {
                sprite.spriteFrame = edge.normal;
                edge.node.setPosition(edge.home);
                edge.node.active = edge.created ? false : edge.active;
            }
        }
        this.showing = free;
    }

    destroy() {
        this.update(false);
        for (const edge of this.edges) if (edge.created) edge.node.destroy();
        this.artwork.destroy();
    }
}
