import { WebAudioMixer } from './web_audio';
const VOICES: Record<number, string> = {
    1: 'voxPayout3tong', 2: 'voxPayout2tiao', 3: 'voxPayout2tong', 4: 'voxPayout5tiao',
    5: 'voxPayout5tong', 6: 'voxPayout8wan', 7: 'voxPayoutBaiban', 8: 'voxPayoutHongzhong', 9: 'voxPayoutFacai',
};
const EFFECTS = ['symbolShrink', 'symbolWild', 'symbolCollapse', 'symbolScatter', 'multiplierA', 'multiplierB',
    'multiplierC', 'fastspinStart', 'fastspinEnd', 'fastspinSuccess', 'bgmBonusIntro', 'uiStart', 'uiCollect',
    'bgmBigwinMain', 'bgmBigwinEnd', 'bgmTotalwinMain', 'bgmTotalwinEnd', 'spinBtn', 'reelLoop',
    'reelStopSingle', 'reelQuickstop', 'prizeMedwin', 'prizeSmallwin', 'maJiangHuLe', 'fsMultiplyRefresh',
    'menu_icon_press', 'slider_effect', 'voxPayoutMultiSym01', 'voxPayoutMultiSym02',
    'infoboardTotalwin', 'infoboardTotalwinMedwinEnd', 'infoboardTotalwinBigwin', 'freespinWon',
    ...Object.values(VOICES), ...[2, 3, 4, 5, 6, 10].map(n => `voxMultiply${n}x`)];
const FREE_AUDIO = ['bgm_bonus_loop', ...[
    'bgmBonusIntro', 'uiStart', 'uiCollect', 'bgmTotalwinMain', 'bgmTotalwinEnd',
    'fsMultiplyRefresh', 'freespinWon', 'voxMultiply6x', 'voxMultiply10x',
].map(name => 'games/' + name)];
/** 游戏事件到音频的唯一映射。符号使用本项目 ID，不套用参考项目的 ID。 */
export class GameAudio {
    constructor(private mixer = new WebAudioMixer()) {}
    private mode = '';
    private popup = false;
    private multiVoice = 0;
    private muted = false;
    private started = false;
    private stopSoundPlayed = false;
    initialize() {
        try { this.muted = localStorage.getItem('aislots-audio-muted') === 'true'; } catch {}
        this.mixer.setMuted(this.muted); this.mixer.attach();
        this.mixer.preload(['bgm_mg', ...EFFECTS.map(name => 'games/' + name).filter(name => !FREE_AUDIO.includes(name))]);
        if (typeof window !== 'undefined') window.addEventListener('aislots-started', this.start, { once: true });
    }
    get freeAssetCount() { return FREE_AUDIO.length; }
    loadFree(progress: () => void) {
        return this.mixer.load(FREE_AUDIO, progress);
    }
    releaseFree() { this.mixer.release(FREE_AUDIO); }
    private start = () => {
        this.started = true;
        const free = this.mode === 'bgm_bonus_loop';
        this.mode = '';
        (this.mixer as any).unlock?.();
        this.setMode(free);
    };
    get isMuted() { return this.muted; }
    toggleMuted() {
        this.muted = !this.muted; this.mixer.setMuted(this.muted);
        try { localStorage.setItem('aislots-audio-muted', String(this.muted)); } catch {}
        return this.muted;
    }
    setMode(free: boolean) {
        const mode = free ? 'bgm_bonus_loop' : 'bgm_mg';
        if (!this.started) { this.mode = mode; return; }
        if (mode === this.mode) return;
        this.mode = mode; this.mixer.play(mode, 'music', { slot: 'bgm', loop: true });
        if (free) {
            this.sound('fsMultiplyRefresh');
        }
    }
    sound(name: string, delay = 0) { this.mixer.play('games/' + name, 'effects', { delay, slot: 'effect:' + name }); }
    stopTransient() {
        for (const name of ['fastspinStart', 'fastspinEnd', 'fastspinSuccess', 'bgmBonusIntro', 'maJiangHuLe', 'uiStart', 'uiCollect', 'bgmBigwinEnd', 'bgmTotalwinEnd'])
            this.mixer.stop('effect:' + name);
    }
    startSpin() {
        this.stopSoundPlayed = false;
        this.sound('spinBtn'); this.sound('reelLoop');
    }
    stopReel(quick: boolean) {
        if (this.stopSoundPlayed) return;
        this.stopSoundPlayed = true;
        this.sound(quick ? 'reelQuickstop' : 'reelStopSingle');
    }
    award(symbols: number[], hasGold: boolean) {
        document.documentElement?.setAttribute('data-audio-award', JSON.stringify(symbols));
        // 对齐参考项目的短音效：独立播放至结束，不能被倍率升级或弹窗截断。
        // 第二个图标仍延迟 0.6 秒；跨轮时也不能取消尚未开始的第二段。
        // Cocos 的 loose spread 会把 [...Set] 编译成 [].concat(Set)，必须显式转成数组。
        const ids = Array.from(new Set(symbols.map(id => id > 1000 ? id - 1000 : id)))
            .filter(id => VOICES[id]);
        if (ids.length <= 2) ids.forEach((id, index) => this.mixer.play('games/' + VOICES[id], 'voice', {
            delay: index * 0.6,
        }));
        else {
            this.multiVoice = this.multiVoice % 2 + 1;
            this.mixer.play('games/voxPayoutMultiSym0' + this.multiVoice, 'voice');
        }
        this.sound(ids.slice(0, 2).some(id => [2, 3, 4].includes(id)) ? 'prizeMedwin' : 'prizeSmallwin');
        this.sound('symbolShrink');
        if (hasGold) this.sound('symbolWild', 0.3);
    }
    multiplier(index: number, factor: string) {
        if (index > 0 && index <= 3) this.sound(['multiplierA', 'multiplierB', 'multiplierC'][index - 1]);
        if ([2, 3, 4, 5, 6, 10].includes(Number(factor)))
            this.mixer.play('games/voxMultiply' + factor + 'x', 'voice', { slot: 'voice:multiplier' });
    }
    beginPopup() {
        this.popup = true; this.mixer.setVolume('music', 0.2);
    }
    popupLoop(name: string) {
        this.beginPopup();
        this.mixer.play('games/' + name, 'popup', { slot: 'popup', loop: true });
    }
    stopPopup() {
        this.mixer.stop('popup');
        if (this.popup) { this.popup = false; this.mixer.setVolume('music', 1); }
    }
    destroy() {
        if (typeof window !== 'undefined') window.removeEventListener('aislots-started', this.start);
        this.mixer.destroy();
    }
}
