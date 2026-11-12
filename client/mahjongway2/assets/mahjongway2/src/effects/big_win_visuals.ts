import { Animation, Vec3, UIOpacity, tween } from 'cc';
import type { NativeEffect } from './effect_library';
import { MWSpriteCtrl } from './MWSpriteCtrl';

/** 1024 原生大奖节点；等级变化时保留累计金额，不重新开始计数。 */
export function applyBigWinTier(effect: NativeEffect, type: number) {
    const panel = effect.node.getChildByPath('panel'), index = type - 1;
    const bgq = panel.getChildByName('bgq');
    bgq.active = true;
    for (let level = 1; level <= 3; level++) {
        for (const side of ['l', 'r']) bgq.getChildByName(`node_${side}_${level}`).active = level <= type;
    }
    for (const name of ['bw_vfx_e_normal', 'bw_vfx_c_add', 'bw_vfx_f_01', 'bw_vfx_b_add'])
        panel.getChildByName(name).active = true;
    panel.getChildByName('bw_vfx_b_add').getComponent(MWSpriteCtrl).setSpriteIndex(index);
    const title = panel.getChildByName('bw_text');
    title.active = true;
    title.getComponent(MWSpriteCtrl).setSpriteIndex(index);
    title.setPosition(0, [56, 96, 136][index], 0);
    title.setScale(0, 0, 0);
    tween(title).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    const light = panel.getChildByName('bw_vfx_d');
    light.active = true;
    light.setPosition(0, [130, 170, 250][index], 0);
    light.setScale(0, 0, 0);
    tween(light).to(0.5, { scale: new Vec3(1.5, 1.5, 1) }, { easing: 'backOut' }).start();
    const flash = panel.getChildByName('bw_solid_a_add');
    flash.active = true;
    flash.setScale(0, 0, 0);
    tween(flash).to(0.5, { scale: new Vec3(5, 5, 1) }).start();
    const opacity = flash.getComponent(UIOpacity);
    opacity.opacity = 255;
    tween(opacity).to(0.5, { opacity: 0 }).start();
    const amount = panel.getChildByName('num');
    amount.active = true;
    if (type === 1) {
        amount.setScale(0, 0, 0);
        tween(amount).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }
    for (const animation of effect.node.getComponentsInChildren(Animation))
        if (animation.defaultClip) animation.play(animation.defaultClip.name);
}
