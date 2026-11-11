import { setStopArtwork } from './stop_control';
import { SymbolTooltip } from './symbol_tooltip';
import { FreePanelView } from './free_panel';
import { GameAudio } from '../audio/game_audio';
import { bigWinFrame, BIG_WIN_COUNT_SECONDS } from './big_win_progression';
import { applyBigWinTier } from './big_win_visuals';
import {
    _decorator,
    Animation,
    Component,
    Node,
    Label,
    Layout,
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
    private audio = new GameAudio();
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
    private freePanelView: FreePanelView = null;
    private bonusParticle: NativeEffect = null;
    private bonusParticleVisible = false;
    private bottomParticle: Node = null;
    private infoBar: Node = null;
    private winBar: Node = null;
    private infoMode: boolean | null = null;
    private infoIndex = 0;
    private bottomWinTier = 0;
    private symbolTooltip: SymbolTooltip = null;
    private previousMultiplier = -1;
    private previousFactors = '';
    private previousFree = false;
    private baseFactors: string[] = [];

    /** 新的付费旋转立即回到普通首档，不沿用上一局的消除倍率。 */
    resetMultiplier() {
        this.audio.setMode(false);
        this.previousMultiplier = -1;
        this.multiplier(this.baseFactors, 0, false);
    }

    async initialize() {
        await EffectLibrary.load();
        this.audio.initialize();
        this.find(this.node, 'btn_sound')?.on(Node.EventType.TOUCH_END, this.toggleSound, this);
        this.refreshSoundButton();
        this.overlay = new Node('effect_overlay');
        this.node.addChild(this.overlay);
        this.overlay.addComponent(UITransform).setContentSize(750, 1400);
        this.overlay.addComponent(BlockInputEvents);
        this.overlay.active = false;
        this.installControls();
        // 使用原项目独立的自动停止美术；场景已有节点时直接复用。
        if (!this.find(this.node, 'btn_autostop')) {
            const panel = this.find(this.node, 'panel1');
            if (panel) EffectLibrary.create('control_autostop', panel).node.name = 'btn_autostop';
        }
        const layout = this.find(this.node, 'layout_bottom');
        this.infoBar = layout?.getChildByName('ib_bar');
        this.winBar = layout?.getChildByName('node_win_big');
        this.resetBottomWin();
        const board = this.find(this.node, 'roll');
        if (board) this.symbolTooltip = new SymbolTooltip(board, () => this.sound('slider_effect'));
        board?.emit('flow-changed');
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
    private freePanelNode: Node = null;
    private freeLoad: Promise<void> = null;
    private freeGeneration = 0;
    private freeAssets: Awaited<ReturnType<typeof EffectLibrary.loadFree>> = [];
    private introLoading = false;
    private retryFreeLoad: (() => void) = null;

    prepareFree(onProgress = (_percent: number) => {}) {
        if (this.freeLoad) return this.freeLoad;
        const generation = this.freeGeneration;
        const total = EffectLibrary.freeAssetCount + this.audio.freeAssetCount;
        let completed = 0;
        const progress = () => {
            if (generation === this.freeGeneration) {
                const percent = Math.floor(++completed * 100 / total);
                onProgress(percent);
            }
        };
        this.freeLoad = Promise.allSettled([
            EffectLibrary.loadFree(progress),
            this.audio.loadFree(progress),
        ]).then(([visuals, audio]) => {
            if (generation !== this.freeGeneration || visuals.status === 'rejected' || audio.status === 'rejected') {
                if (visuals.status === 'fulfilled') visuals.value.forEach(({ asset }) => asset.decRef());
                if (generation !== this.freeGeneration) return;
                this.freeLoad = null;
                throw new Error('免费资源加载失败');
            }
            this.freeAssets = visuals.value;
            for (const { name, asset } of this.freeAssets) EffectLibrary.prefabs.set(name, asset);
            this.createFreeViews();
        });
        return this.freeLoad;
    }

    private createFreeViews() {
        this.bonusParticle = EffectLibrary.create('bonus_bg_particle', this.node);
        // 对应参考 ui_reel：在盘面和静态装饰之上、弹窗之下显示。
        this.bonusParticle.node.setSiblingIndex(this.overlay.getSiblingIndex());
        const layout = this.find(this.node, 'layout_bottom');
        if (layout) {
            this.bottomParticle = EffectLibrary.create('bonus_bg_particle', layout).node;
            this.bottomParticle.setPosition(0, 192.981, 0);
            this.bottomParticle.setScale(1.7, 1.7, 1);
            this.bottomParticle.setSiblingIndex(0);
        }
        const normal = layout?.getChildByName('panel1'), menu = layout?.getChildByName('panel2');
        if (layout && normal && menu) {
            const panel = EffectLibrary.create('panel_free', layout).node;
            panel.name = 'panel_free';
            // 适配当前金额栏：给原版双行提示和 150 高度数字留出空间。
            panel.setPosition(normal.position.x, normal.position.y + 75, normal.position.z);
            this.freePanelNode = panel;
            this.freePanelView = new FreePanelView({ root: panel, normal, menu,
                remaining: panel.getChildByName('remaining_fs'), last: panel.getChildByName('last_fs'),
                counter: panel.getChildByPath('remaining_fs/fnt_1').getComponent(Label),
                footer: ['info', 'lab_coin', 'lab_bet', 'lab_win'].map(name => this.find(this.node, name)).filter(Boolean),
            });
        }
    }

    releaseFree() {
        this.freeGeneration++;
        this.freeLoad = null;
        this.updateBonusParticle(false);
        this.freePanelView?.update(false, 0);
        this.freePanelView = null;
        this.freePanelNode?.destroy();
        this.freePanelNode = null;
        this.bottomParticle?.destroy();
        this.bottomParticle = null;
        this.bonusParticle?.destroy();
        this.bonusParticle = null;
        for (const name of ['pop_free_again', 'pop_free_end']) {
            this.popups.get(name)?.destroy();
            this.popups.delete(name);
        }
        for (const { name, asset } of this.freeAssets) {
            EffectLibrary.prefabs.delete(name);
            asset.decRef();
        }
        this.freeAssets = [];
        this.audio.releaseFree();
    }

    refreshControls() { this.updateControls(); }

    private updateControls() {
        const flow = this.node.getChildByName('roll')?.getComponent('slots_base') as Component & {
            state: number;
            click_stop: boolean;
            fast: boolean;
            autoSpinRunning: boolean;
            freePanelActive: boolean;
            freeSpinsRemaining: number;
        };
        if (!flow) return;
        this.symbolTooltip?.update(0, flow.state === 0 && !flow.autoSpinRunning);
        this.freePanelView?.update(!!flow.freePanelActive, flow.freeSpinsRemaining || 0);
        this.updateBonusParticle(!!flow.freePanelActive);
        if (this.infoBar?.active) this.showBottomNotice(!!flow.freePanelActive);
        const rolling = flow.state === 1 || flow.state === 2;
        if (rolling && !this.wasRolling) {
            const stop = this.controls.get('control_stop');
            if (stop?.node.getComponent(Animation)?.getState('spin_click')) stop.play('spin_click');
        }
        this.wasRolling = rolling;
        const stop = this.controls.get('control_stop');
        if (stop) setStopArtwork(stop.node, flow.click_stop || !rolling);
        const turbo = this.controls.get('control_turbo');
        if (turbo) {
            turbo.node.getChildByPath('txt_turbo_on').active = flow.fast;
            turbo.node.getChildByPath('txt_turbo_off').active = !flow.fast;
            turbo.node.getChildByPath('txt_turbo_on/turbo_lightning').active = flow.fast;
        }
    }
    setFreeCounterLift(lift: number) {
        this.freePanelView?.setCounterLift(lift);
    }

    resetBottomWin() {
        this.bottomWinTier = 0;
        this.stopBottomWinCount();
        this.winBar?.getComponent(Animation)?.stop();
        if (this.winBar) this.winBar.active = false;
        if (this.infoBar) this.infoBar.active = true;
        this.refreshControls();
    }

    showBottomWin(amount: string, tier: number, total: boolean, count?: { minor: string; seconds: number }) {
        if (!this.winBar || !this.infoBar) return 0;
        this.stopBottomNotice();
        this.infoBar.active = false;
        this.winBar.active = true;
        const animation = this.winBar.getComponent(Animation);
        const clip = tier === 3 ? 'win_c' : total || (tier === 2 && this.bottomWinTier === 2)
            ? 'win_end' : tier === 2 ? 'win_a_to_b' : 'win_a';
        if (!total) this.winBar.children.forEach(node => { node.active = false; });
        animation?.play(clip);
        // win_end does not activate the background after the children are reset.
        if (clip === 'win_end') {
            const selected = tier === 2 ? 'ib_bar_b' : 'ib_bar_a';
            for (const name of ['ib_bar_a', 'ib_bar_b', 'ib_bar_c']) {
                const background = this.winBar.getChildByName(name);
                if (background) background.active = name === selected;
            }
        }
        this.bottomWinTier = tier;
        const sound = tier === 3 ? 'infoboardTotalwinBigwin'
            : tier === 2 ? 'infoboardTotalwinMedwinEnd' : 'infoboardTotalwin';
        this.sound(this.bonusParticleVisible ? 'freespinWon' : sound);
        const info = this.winBar.getChildByName('num_info');
        info.active = true;
        const award = info.getChildByName('award').getComponent(Label);
        Tween.stopAllByTarget(award);
        const layout = info.getComponent(Layout);
        if (layout) layout.enabled = true;
        info.getChildByName('info_win').getComponent(MWSpriteCtrl)?.setSpriteIndex(total ? 1 : 0);
        award.string = amount;
        if (count) {
            // Measure the final amount once so digit changes cannot shift the title.
            award.updateRenderData(true);
            layout?.updateLayout(true);
            if (layout) layout.enabled = false;
            award.string = rollMoney(count.minor, 0);
            tween(award)
                .to(count.seconds, {}, {
                    onUpdate: (_, progress) => { award.string = rollMoney(count.minor, progress); },
                })
                .call(() => { award.string = amount; })
                .start();
        }
        const state = animation?.getState(clip);
        const clipSeconds = state && state.speed > 0 ? state.duration / state.speed : 0;
        return Math.max(clipSeconds, count?.seconds ?? 0);
    }

    private stopBottomWinCount() {
        const award = this.winBar?.getChildByPath('num_info/award')?.getComponent(Label);
        if (award) Tween.stopAllByTarget(award);
    }

    private showBottomNotice(free: boolean) {
        if (this.infoMode === free) return;
        this.stopBottomNotice();
        this.infoMode = free;
        this.infoIndex = Math.floor(Math.random() * 5);
        const mask = this.infoBar.getChildByName('mask');
        const text = mask.getChildByName('info_main');
        const sprite = text.getComponent(MWSpriteCtrl);
        const rotate = () => {
            sprite.setSpriteIndex(free ? 5 : this.infoIndex);
            this.infoIndex = (this.infoIndex + 1) % 5;
            const width = text.getComponent(UITransform).width;
            const available = mask.getComponent(UITransform).width;
            const y = text.position.y;
            Tween.stopAllByTarget(text);
            text.setPosition(width > available ? (width - available) / 2 + 30 : 0, y, 0);
            if (width > available) {
                tween(text).delay(0.5)
                    .to(4.4, { position: new Vec3(-(available + width) / 2 - 5, y, 0) })
                    .start();
            }
        };
        rotate();
        tween(this.infoBar).repeatForever(tween<Node>().delay(5).call(rotate)).start();
    }

    private stopBottomNotice() {
        this.infoMode = null;
        if (!this.infoBar) return;
        Tween.stopAllByTarget(this.infoBar);
        const text = this.infoBar.getChildByPath('mask/info_main');
        if (text) Tween.stopAllByTarget(text);
    }

    private updateBonusParticle(visible: boolean) {
        if (!this.bonusParticle || visible === this.bonusParticleVisible) return;
        this.bonusParticleVisible = visible;
        if (this.bottomParticle) {
            this.bottomParticle.active = visible;
            const animation = this.bottomParticle.getComponent(Animation);
            if (visible) animation?.play();
            else animation?.stop();
        }
        if (visible) {
            this.bonusParticle.reset();
            this.bonusParticle.loops();
        } else {
            this.bonusParticle.node.getComponent(Animation)?.stop();
            this.bonusParticle.hide();
        }
    }
    private refreshSoundButton() {
        const button = this.find(this.node, 'btn_sound');
        const on = button?.getChildByName('ic_soundon'), off = button?.getChildByName('ic_soundoff');
        if (on) on.active = !this.audio.isMuted;
        if (off) off.active = this.audio.isMuted;
    }
    private toggleSound() { this.audio.toggleMuted(); this.refreshSoundButton(); }
    showSymbolTooltip(cell: Node, value: number, column: number) { this.symbolTooltip?.show(cell,value,column); }
    setAudioMode(free: boolean) { this.audio.setMode(free); }
    spinSound() { this.audio.startSpin(); }
    reelStopped(quick: boolean) { this.audio.stopReel(quick); }
    awardSound(symbols: number[], hasGold: boolean) { this.audio.award(symbols, hasGold); }
    private playMusic(name: string) { this.audio.popupLoop(name); }
    private endMusic(playEnd = true) {
        // Always stop the looping popup track, even when the ending cue was already started.
        this.audio.stopPopup();
        if (this.endingSoundPlayed) return;
        this.endingSoundPlayed = true;
        if (!playEnd) return;
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
    sound(name: string) { this.audio.sound(name); }
    stopTransientAudio() { this.audio.stopTransient(); }

    multiplier(factors: string[], index: number, free: boolean, repeatSound = false) {
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

            }
        }
        if (changed || repeatSound || (free && !this.previousFree && this.previousMultiplier >= 0))
            this.audio.multiplier(index, factors[index]);
        this.previousFree = free;
        this.previousMultiplier = index;
        this.previousFactors = factors.join(',');
    }
    async enterFreeMultipliers() {
        if (!this.multipliers) return;
        const root = this.multipliers.node;
        this.audio.sound('fsMultiplyRefresh');
        for (let i = 1; i <= 4; i++) {
            const gray = root.getChildByName('gray_' + i);
            const light = root.getChildByName('light_' + i);
            const glow = root.getChildByName('guang_' + i);
            const anim = root.getChildByName('anim_' + i);
            if (!gray || !light) continue;
            Tween.stopAllByTarget(light);
            if (!this.multiplierScales.has(light))
                this.multiplierScales.set(light, light.scale.clone());
            const resting = this.multiplierScales.get(light);
            const opacity = light.getComponent(UIOpacity) || light.addComponent(UIOpacity);
            gray.active = true;
            light.active = false;
            if (glow) glow.active = false;
            if (anim) anim.active = false;
            gray.getComponent(MWSpriteCtrl)?.setSpriteIndex(0);
            light.getComponent(MWSpriteCtrl)?.setSpriteIndex(1);
            this.scheduleOnce(() => {
                if (!light.isValid || !gray.isValid) return;
                light.active = true;
                opacity.opacity = 255;
                light.setScale(resting.x * 1.5, resting.y * 1.5, resting.z);
                tween(opacity).to(0.3, { opacity: 0 }).start();
                if (anim) {
                    anim.active = true;
                    anim.getComponent(Animation)?.play();
                }
                tween(light)
                    .to(0.3, { scale: resting.clone() })
                    .call(() => {
                        gray.getComponent(MWSpriteCtrl)?.setSpriteIndex(1);
                        light.active = false;
                        opacity.opacity = 255;
                    })
                    .start();
            }, 0.3 * (i - 1));
        }
        await new Promise<void>(resolve => this.scheduleOnce(resolve, 1.2));
        if (!this.isValid || !root.isValid) return;
        for (let i = 1; i <= 4; i++) {
            const light = root.getChildByName('light_' + i);
            const opacity = light?.getComponent(UIOpacity);
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 255;
            }
        }
        this.multiplier(['2', '4', '6', '10'], 0, true);
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
        this.audio.beginPopup();
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
                    this.introLoading = false;
                    this.retryFreeLoad = null;
                    this.audio.stopTransient();
                    this.audio.stopPopup();
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
                    this.overlay.off(Node.EventType.TOUCH_END, this.dismissOverlay, this);
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
            this.audio.stopTransient();
            this.endMusic(false);
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
        this.overlay.on(Node.EventType.TOUCH_END, this.dismissOverlay, this);
        setup(effect);
        return result;
    }
    /** 回放退出/切入时立即释放弹窗，不等待点击门槛或退出动画。 */
    cancelPresentation() {
        this.popupFinish?.();
        this.symbolTooltip?.update(0, false);
        this.stopTransientAudio();
    }

    private dismissOverlay() {
        if (this.popupName !== 'pop_free_tri') this.dismiss();
    }

    dismiss() {
        if (!this.popupFinish) return false;
        if (this.introLoading) {
            this.retryFreeLoad?.();
            return true;
        }
        if (this.popupAge < 0.5 || this.popupClosing || this.lastDismissAge === this.popupAge)
            return true;
        this.lastDismissAge = this.popupAge;
        if (this.completeCount) {
            this.completeCount();
            // Skipping the count shows the final amount and starts the ending cue.
            this.endMusic();
            this.completeCount = null;
            this.popupTick = null;
            return true;
        }
        this.popupExit?.();
        return true;
    }
    intro(count: number, autoDismiss = false) {
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
                const button = effect.node.getChildByPath('panel/button');
                const spinner = effect.node.getChildByPath('panel/bonus_lading');
                let labelNode = spinner.parent.getChildByName('bonus_lab');
                if (!labelNode) {
                    labelNode = new Node('bonus_lab');
                    labelNode.layer = spinner.layer;
                    spinner.parent.addChild(labelNode);
                    labelNode.setPosition(spinner.position.x, spinner.position.y - 55);
                    labelNode.addComponent(Label).fontSize = 28;
                    labelNode.on(Node.EventType.TOUCH_END, () => this.retryFreeLoad?.());
                }
                const label = labelNode.getComponent(Label);
                const finish = this.popupFinish;
                const load = () => {
                    this.retryFreeLoad = null;
                    this.introLoading = true;
                    spinner.active = labelNode.active = true;
                    button.active = false;
                    label.string = '0%';
                    void this.prepareFree(percent => {
                        if (this.popupFinish === finish) label.string = percent + '%';
                    }).then(() => {
                        if (this.popupFinish !== finish) return;
                        this.introLoading = false;
                        spinner.active = labelNode.active = false;
                        button.active = true;
                        this.popupAge = 0;
                        this.lastDismissAge = -1;
                        this.popupTimeout = autoDismiss ? 8 : Infinity;
                        this.sound('bgmBonusIntro');
                        this.sound('maJiangHuLe');
                        this.sound('fastspinSuccess');
                    }).catch(() => {
                        if (this.popupFinish !== finish) return;
                        spinner.active = false;
                        label.string = '加载失败，点击重试';
                        this.retryFreeLoad = load;
                    });
                };
                this.popupTick = age => spinner.setRotationFromEuler(0, 0, -age * 360);
                this.introLoading = true;
                button.active = false;
                spinner.active = labelNode.active = true;
                label.string = '0%';
                this.scheduleOnce(() => {
                    if (this.popupFinish === finish) load();
                });
            },
            Infinity,
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
                this.sound('maJiangHuLe');
                this.sound('fastspinSuccess');
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
        this.symbolTooltip?.update(dt, true);
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
        this.stopBottomWinCount();
        this.stopBottomNotice();
        this.symbolTooltip?.destroy();
        this.popupFinish?.();
        this.find(this.node, 'btn_sound')?.off(Node.EventType.TOUCH_END, this.toggleSound, this);
        this.releaseFree();
        this.audio.destroy();
    }
}
/** 只累计已结算金额，使用整数运算避免大额计数精度损失。 */
export function rollMoney(amount: string, progress: number) {
    const minor = (
        (BigInt(amount) * BigInt(Math.floor(Math.max(0, Math.min(1, progress)) * 10000))) /
        BigInt(10000)
    );
    const negative = minor < 0n;
    const value = negative ? -minor : minor;
    return (negative ? '-' : '') + (Number(value) / 100).toFixed(2);
}
export { bigWinType } from './big_win_progression';
