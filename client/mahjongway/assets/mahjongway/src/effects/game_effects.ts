import { bigWinFrame, BIG_WIN_COUNT_SECONDS } from './big_win_progression';
import { applyBigWinTier } from './big_win_visuals';
import {
    _decorator,
    Animation,
    AudioSource,
    Component,
    Node,
    Label,
    Sprite,
    UIOpacity,
    UITransform,
    BlockInputEvents,
    Button,
    tween,
    Tween,
    Color,
    Vec3,
} from 'cc';
import { EffectLibrary, NativeEffect } from './effect_library';
import { MWSpriteCtrl } from './MWSpriteCtrl';
const { ccclass } = _decorator;

/** 弹窗只负责演出，不发送确认、不决定中奖或改变服务端结算顺序。 */
@ccclass('GameEffects')
export class GameEffects extends Component {
    private audio: AudioSource;
    private music: AudioSource;
    private popupName = '';
    private endingSoundPlayed = false;
    private overlay: Node;
    private popups = new Map<string, NativeEffect>();
    private multipliers: NativeEffect;
    private multiplierScales = new Map<Node, Vec3>();
    private anticipation = new Map<number, NativeEffect>();
    private popupFinish: () => void = null;
    private popupAge = 0;
    private lastDismissAge = -1;
    private popupClosing = false;
    private popupExit: () => void = null;
    private completeCount: () => void = null;
    private popupTimeout = 0;
    private popupTick: (age: number) => void = null;
    private coinParent: Node = null;
    private coinMode: 'radial' | 'fountain' = null;
    private coinAge = 0;
    private coins: Array<{
        effect: NativeEffect;
        kind: string;
        age: number;
        life: number;
        vx: number;
        vy: number;
        gravity: number;
    }> = [];
    private coinPool = new Map<string, NativeEffect[]>();
    private tier = 0;
    private controls = new Map<string, NativeEffect>();
    private wasRolling = false;
    private previousMultiplier = -1;
    private previousFactors = '';
    private baseFactors: string[] = [];

    /** 新的付费旋转立即回到普通首档，不沿用上一局的消除倍率。 */
    resetMultiplier() {
        this.previousMultiplier = -1;
        this.multiplier(this.baseFactors, 0, false);
    }

    async initialize() {
        await EffectLibrary.load();
        this.audio = this.node.addComponent(AudioSource);
        this.music = this.node.addComponent(AudioSource);
        this.overlay = new Node('effect_overlay');
        this.node.addChild(this.overlay);
        this.overlay.addComponent(UITransform).setContentSize(750, 1400);
        this.overlay.addComponent(BlockInputEvents);
        this.overlay.active = false;
        this.installControls();
        // 倍率条由场景配置，直接绑定现有节点，保持编辑器设置的位置和层级。
        const multipliers = this.find(this.node, 'multipliers');
        if (!multipliers) throw new Error('场景缺少 multipliers 倍率条节点');
        this.multipliers = new NativeEffect(multipliers);
    }
    /** 只替换按钮内部美术，保留场景已有点击绑定和可视化布局。 */
    private installControls() {
        for (const [name, nodeName] of [
            ['control_spin', 'spin'],
            ['control_stop', 'stop'],
            ['control_turbo', 'turbo'],
        ]) {
            const parent = this.find(this.node, nodeName);
            if (!parent) continue;
            const sprite = parent.getComponent(Sprite);
            if (sprite) sprite.enabled = false;
            parent.children.forEach((child) => (child.active = false));
            const effect = EffectLibrary.create(name, parent);
            effect.reset();
            effect.node.setPosition(0, name === 'control_turbo' ? 0 : 25);
            effect.loops();
            this.controls.set(name, effect);
        }
    }
    private updateControls() {
        const flow = this.node.getChildByName('roll')?.getComponent('slots_base') as Component & {
            state: number;
            fast: boolean;
        };
        if (!flow) return;
        const rolling = flow.state === 1 || flow.state === 2;
        if (rolling && !this.wasRolling) {
            const stop = this.controls.get('control_stop');
            if (stop?.node.getComponent(Animation)?.getState('spin_click')) stop.play('spin_click');
        }
        this.wasRolling = rolling;
        const turbo = this.controls.get('control_turbo');
        if (turbo) {
            turbo.node.getChildByPath('txt_turbo_on').active = flow.fast;
            turbo.node.getChildByPath('txt_turbo_off').active = !flow.fast;
            turbo.node.getChildByPath('txt_turbo_on/turbo_lightning').active = flow.fast;
        }
    }
    private playMusic(name: string) {
        const clip = EffectLibrary.sounds.get(name);
        if (clip) {
            this.music.stop();
            this.music.clip = clip;
            this.music.loop = true;
            this.music.volume = 0.6;
            this.music.play();
        }
    }
    private endMusic() {
        if (this.endingSoundPlayed) return;
        this.endingSoundPlayed = true;
        this.music?.stop();
        if (this.popupName === 'big_win') this.sound('bgmBigwinEnd');
        else if (this.popupName === 'pop_free_end') this.sound('bgmTotalwinEnd');
    }
    private find(node: Node, name: string): Node {
        if (node.name === name) return node;
        for (const child of node.children) {
            const found = this.find(child, name);
            if (found) return found;
        }
        return null;
    }
    sound(name: string) {
        const clip = EffectLibrary.sounds.get(name);
        if (clip && this.audio) this.audio.playOneShot(clip, 0.7);
    }
    multiplier(factors: string[], index: number, free: boolean) {
        if (!free && factors?.length) this.baseFactors = [...factors];
        if (!this.multipliers || !factors?.length) return;
        const root = this.multipliers.node,
            changed =
                this.previousMultiplier >= 0 &&
                index > this.previousMultiplier &&
                this.previousFactors === factors.join(',');
        root.getComponentsInChildren(MWSpriteCtrl).forEach((ctrl) =>
            ctrl.setSpriteIndex(free ? 1 : 0),
        );
        const refreshScale = this.previousMultiplier !== index ||
            this.previousFactors !== factors.join(',');
        const standard = free ? ['2', '4', '6', '10'] : ['1', '2', '3', '5'];
        for (let i = 1; i <= 4; i++) {
            const gray = root.getChildByPath('gray_' + i),
                light = root.getChildByPath('light_' + i),
                glow = root.getChildByPath('guang_' + i),
                anim = root.getChildByPath('anim_' + i);
            if (light) {
                if (!this.multiplierScales.has(light))
                    this.multiplierScales.set(light, light.scale.clone());
                if (refreshScale) {
                    // 切档或新局复位时取消旧缩放，避免快速切换后倍率大小残留。
                    Tween.stopAllByTarget(light);
                    light.setScale(this.multiplierScales.get(light));
                }
            }
            if (gray) gray.active = i - 1 !== index;
            if (light) light.active = i - 1 === index;
            if (glow) glow.active = i - 1 === index;
            if (anim) anim.active = false;
            for (const node of [gray, light])
                if (node) {
                    const sprite = node.getComponent(Sprite);
                    let label = node.getChildByName('configured_multiplier');
                    const custom = factors[i - 1] !== standard[i - 1];
                    if (sprite) sprite.enabled = !custom;
                    if (custom && !label) {
                        label = new Node('configured_multiplier');
                        node.addChild(label);
                        const text = label.addComponent(Label);
                        text.fontSize = 60;
                        text.color = Color.YELLOW;
                    }
                    if (label) {
                        label.active = custom;
                        label.getComponent(Label).string = 'x' + (factors[i - 1] || '1');
                    }
                }
            if (changed && i - 1 === index && light) {
                const resting = this.multiplierScales.get(light);
                // 参考 MWCenterRollCtrl：0.3 秒放大、0.2 秒缩回。
                // 按当前场景的原始缩放等比例播放，不改动编辑器里的静态大小。
                tween(light)
                    .to(0.3, { scale: new Vec3(resting.x * 1.5, resting.y * 1.5, resting.z) })
                    .to(0.2, { scale: resting.clone() })
                    .start();
            }
            if (changed && i - 1 === index && anim) {
                anim.active = true;
                anim.getComponent(Animation)?.play();
                if (index > 0 && index <= 3)
                    this.sound(['multiplierA', 'multiplierB', 'multiplierC'][index - 1]);
            }
        }
        this.previousMultiplier = index;
        this.previousFactors = factors.join(',');
    }
    setAnticipation(column: number, visible: boolean, parent: Node) {
        let effect = this.anticipation.get(column);
        if (visible) {
            if (!effect) {
                effect = EffectLibrary.create('node_anti', parent);
                this.anticipation.set(column, effect);
            }
            Tween.stopAllByTarget(effect.node.getComponent(UIOpacity));
            effect.reset();
            effect.node.setPosition(0, -parent.position.y);
            effect.node.setSiblingIndex(parent.children.length - 1);
            effect.loops();
            this.sound('fastspinStart');
        } else if (effect?.node.active) {
            const opacity =
                effect.node.getComponent(UIOpacity) || effect.node.addComponent(UIOpacity);
            tween(opacity)
                .to(0.2, { opacity: 0 })
                .call(() => effect.hide())
                .start();
            this.sound('fastspinEnd');
        }
    }
    private popup(name: string, setup: (effect: NativeEffect) => void, seconds: number) {
        if (this.popupFinish) throw new Error('演出重叠');
        this.overlay.active = true;
        this.overlay.setSiblingIndex(this.node.children.length - 1);
        let effect = this.popups.get(name);
        if (!effect) {
            effect = EffectLibrary.create(name, this.overlay);
            this.popups.set(name, effect);
        }
        effect.reset();
        effect.node.setPosition(0, 0);
        this.popupAge = 0;
        this.lastDismissAge = -1;
        this.popupName = name;
        this.endingSoundPlayed = false;
        this.coinAge = 0;
        this.popupTimeout = seconds;
        this.popupClosing = false;
        this.completeCount = null;
        const opacity = effect.node.getChildByPath('panel')?.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
        const result = new Promise<void>(
            (resolve) =>
                (this.popupFinish = () => {
                    this.popupFinish = null;
                    this.music?.stop();
                    this.popupTick = null;
                    this.coinMode = null;
                    this.coinParent = null;
                    for (const coin of this.coins) {
                        coin.effect.hide();
                        this.recycleCoin(coin.effect, coin.kind);
                    }
                    this.coins = [];
                    effect.hide();
                    this.overlay.active = false;
                    this.overlay.off(Node.EventType.TOUCH_END, this.dismiss, this);
                    effect.node
                        .getComponentsInChildren(Button)
                        .forEach((button) =>
                            button.node.off(Button.EventType.CLICK, this.dismiss, this),
                        );
                    resolve();
                }),
        );
        this.popupExit = () => {
            const finish = this.popupFinish;
            this.popupClosing = true;
            this.endMusic();
            if (name === 'pop_free_end') this.sound('uiCollect');
            if (name === 'pop_free_tri') {
                this.sound('uiStart');
                const seconds = effect.play('pop_end_free', 'panel');
                this.scheduleOnce(() => {
                    if (this.popupFinish === finish) finish?.();
                }, seconds);
            } else {
                const opacity =
                    effect.node.getComponent(UIOpacity) || effect.node.addComponent(UIOpacity);
                tween(opacity)
                    .to(0.3, { opacity: 0 })
                    .call(() => {
                        if (this.popupFinish === finish) finish?.();
                    })
                    .start();
            }
        };
        // 原预制体的Button会拦截触摸冒泡，必须直接接管其click事件。
        effect.node
            .getComponentsInChildren(Button)
            .forEach((button) => button.node.on(Button.EventType.CLICK, this.dismiss, this));
        this.overlay.on(Node.EventType.TOUCH_END, this.dismiss, this);
        setup(effect);
        return result;
    }
    dismiss() {
        if (!this.popupFinish) return false;
        if (this.popupAge < 0.5 || this.popupClosing || this.lastDismissAge === this.popupAge)
            return true;
        this.lastDismissAge = this.popupAge;
        if (this.completeCount) {
            this.completeCount();
            this.endMusic();
            this.completeCount = null;
            this.popupTick = null;
            return true;
        }
        this.popupExit?.();
        return true;
    }
    intro(count: number) {
        return this.popup(
            'pop_free_tri',
            (effect) => {
                effect.node.getChildByPath('panel/cnt').getComponent(Label).string = String(count);
                // 免费倍率独立配置，不能沿用原版美术中“固定翻倍”的承诺。
                const subtitle = effect.node
                    .getChildByPath('panel/feature_loading')
                    ?.getComponent(Sprite);
                if (subtitle) subtitle.enabled = false;
                effect.play('pop_tri_free', 'panel');
                this.sound('bgmBonusIntro');
            },
            8,
        );
    }
    retrigger(count: number) {
        return this.popup(
            'pop_free_again',
            (effect) => {
                const label =
                    effect.node.getChildByPath('panel/cnt') ||
                    effect.node.getChildByPath('panel/bl_icon/cnt');
                label.getComponent(Label).string = String(count);
                effect.play('pop_tri_free_again', 'panel');
                this.sound('bgmBonusIntro');
            },
            2,
        );
    }
    freeEnd(amount: string) {
        return this.popup(
            'pop_free_end',
            (effect) => {
                this.coinMode = 'fountain';
                this.coinParent = effect.node.getChildByPath('panel/node_coin');
                this.tier = 0;
                this.completeCount = () =>
                    (effect.node.getChildByPath('panel/award').getComponent(Label).string =
                        rollMoney(amount, 1));
                this.popupTick = (age) =>
                    (effect.node.getChildByPath('panel/award').getComponent(Label).string =
                        rollMoney(amount, age / 4));
                const button = effect.node.getChildByPath('panel/button');
                if (button) {
                    button.active = true;
                    button.setScale(1, 1, 1);
                }
                effect.node.getChildByPath('panel/anim2')?.getComponent(Animation)?.play();
                this.playMusic('bgmTotalwinMain');
            },
            10,
        );
    }
    bigWin(amount: string, type: number, bet: string) {
        return this.popup('big_win', effect => {
            const label = effect.node.getChildByPath('panel/num/award_num').getComponent(Label);
            this.tier = 0;
            this.coinMode = 'radial';
            this.coinParent = effect.node.getChildByPath('panel/node_coin');
            const render = (age: number) => {
                const frame = bigWinFrame(amount, bet, type, age);
                if (frame.tier !== this.tier) {
                    applyBigWinTier(effect, frame.tier);
                    this.tier = frame.tier;
                }
                label.string = rollMoney(frame.amount, 1);
            };
            render(0);
            // 点击跳过计数仍直接显示最终金额和最终等级。
            this.completeCount = () => render(BIG_WIN_COUNT_SECONDS);
            this.popupTick = render;
            this.playMusic('bgmBigwinMain');
        }, BIG_WIN_COUNT_SECONDS + 1);
    }
    private recycleCoin(effect: NativeEffect, kind: string) {
        const pool = this.coinPool.get(kind) || [];
        pool.push(effect);
        this.coinPool.set(kind, pool);
    }
    update(dt: number) {
        this.updateControls();
        dt = Math.min(dt, 0.1);
        if (this.popupFinish) {
            this.popupAge += dt;
            this.popupTick?.(this.popupAge);
            if (this.popupAge >= this.popupTimeout && !this.popupClosing) {
                this.completeCount = null;
                this.popupExit?.();
            }
        }
        if (this.coinMode && this.coinParent) {
            this.coinAge += dt;
            while (this.coinAge >= 0.05) {
                this.coinAge -= 0.05;
                const kind = this.tier === 3 ? 'bw_particle_b' : 'bw_particle_a';
                const effect =
                    this.coinPool.get(kind)?.pop() || EffectLibrary.create(kind, this.coinParent);
                effect.node.parent = this.coinParent;
                effect.reset();
                effect.loops();
                const fountain = this.coinMode === 'fountain',
                    angle = fountain
                        ? ((75 + Math.random() * 30) * Math.PI) / 180
                        : Math.random() * Math.PI * 2;
                const speed = fountain ? 3000 + Math.random() * 50 : 1334 / 2.5;
                this.coins.push({
                    effect,
                    kind,
                    age: 0,
                    life: fountain ? (2 * speed * Math.sin(angle)) / 6588 : 2.5,
                    vx: speed * Math.cos(angle),
                    vy: speed * Math.sin(angle),
                    gravity: fountain ? -6588 : 0,
                });
            }
        }
        this.coins = this.coins.filter((coin) => {
            coin.age += dt;
            if (coin.age >= coin.life) {
                coin.effect.hide();
                this.recycleCoin(coin.effect, coin.kind);
                return false;
            }
            coin.effect.node.setPosition(
                coin.vx * coin.age,
                coin.vy * coin.age + (coin.gravity * coin.age * coin.age) / 2,
            );
            return true;
        });
    }
    onDestroy() {
        this.popupFinish?.();
        this.node.getComponents(AudioSource).forEach((source) => source.stop());
    }
}
/** 只累计已结算金额，使用整数运算避免大额计数精度损失。 */
export function rollMoney(amount: string, progress: number) {
    return (
        (BigInt(amount) * BigInt(Math.floor(Math.max(0, Math.min(1, progress)) * 10000))) /
        BigInt(10000)
    ).toLocaleString();
}
export function bigWinType(amount: string, bet: string) {
    const win = BigInt(amount),
        stake = BigInt(bet);
    return stake <= BigInt(0)
        ? 0
        : win >= stake * BigInt(50)
          ? 3
          : win >= stake * BigInt(15)
            ? 2
            : win >= stake * BigInt(5)
              ? 1
              : 0;
}
