import { Animation, Vec3, tween } from 'cc';
import type { NativeEffect } from './effect_library';
import { MWSpriteCtrl } from './MWSpriteCtrl';

/** 升级标题、金币堆和光效；升级时金额节点保持可见，不重新归零。 */
export function applyBigWinTier(effect: NativeEffect, type: number) {
    const panel = effect.node.getChildByPath('panel'),
        index = type - 1;
    const pile = panel.getChildByName('pile');
    for (const name of ['bw_cash_pile_l', 'bw_cash_pile_r']) {
        const n = pile.getChildByName(name);
        n.active = index > 0;
        n.setPosition(
            name.endsWith('_l') ? [0, -165, -170][index] : [0, 180, 180][index],
            name.endsWith('_l') ? [0, 15, 152][index] : [0, 10, 155][index],
        );
    }
    for (const name of [
        'bw_cash_pile_l-001',
        'bw_cash_pile_r-001',
        'bw_yuanbao_pile',
        'bw_yuanbao_pile-001',
    ])
        pile.getChildByName(name).active = index === 2;
    const coinPile = pile.getChildByName('bw_coin_pile');
    coinPile.setPosition(0, [0, 32, 134][index]);
    coinPile.setScale(index === 2 ? 1.1 : 1, index === 2 ? 1.1 : 1, 1);
    panel
        .getChildByName('bw_vfx_a')
        .setScale([1, 1.2, 1.4][index], [1, 1.2, 1.4][index], 1);
    panel
        .getChildByName('bw_vfx_b')
        .setScale([1.3, 1.5, 1.7][index], [1.3, 1.5, 1.7][index], 1);
    for (const name of type === 1 ? ['pile', 'tit', 'num'] : ['pile', 'tit']) {
        const node = panel.getChildByName(name);
        node.setScale(0, 0, 1);
        tween(node)
            .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }
    effect.node
        .getChildByPath('panel/tit')
        .getComponent(MWSpriteCtrl)
        .setSpriteIndex(type - 1);
    for (const animation of effect.node.getComponentsInChildren(Animation))
        if (animation.defaultClip) animation.play(animation.defaultClip.name);
}
