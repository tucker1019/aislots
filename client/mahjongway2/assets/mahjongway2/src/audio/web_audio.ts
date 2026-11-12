const AUDIO_REVISION = 'f6d7b1c21b90';
export type AudioBus = 'music' | 'effects' | 'voice' | 'popup';
interface PlayOptions { slot?: string; loop?: boolean; delay?: number }
/** 独立于 Cocos：缓存解码结果，按通道控制播放，取消过期的异步播放请求。 */
export class WebAudioMixer {
    private context: AudioContext = null;
    private master: GainNode;
    private buses = new Map<AudioBus, GainNode>();
    private buffers = new Map<string, Promise<AudioBuffer>>();
    private revisions = new Map<string, number>();
    private sources = new Map<string, AudioBufferSourceNode>();
    private sequence = 0;
    private disposed = false;
    private muted = false;
    private warned = new Set<string>();
    private events: object[] = [];
    private trace(action: string, name: string, details: object = {}) {
        if (typeof location === 'undefined' || !new URLSearchParams(location.search).has('audioDebug')) return;
        this.events.push({ action, name, time: this.context?.currentTime, ...details });
        this.events = this.events.slice(-60);
        document.documentElement?.setAttribute('data-audio-events', JSON.stringify(this.events));
    }
    constructor(private base = '',
        private createContext = () => new AudioContext(),
        private fetchAudio = (url: string) => fetch(url)) {}
    private ensure() {
        if (this.disposed) return null;
        if (!this.context) {
            this.context = this.createContext();
            // 轻量诊断信息，便于预览中确认实际音频后端和浏览器解锁状态。
            document.documentElement?.setAttribute('data-audio-backend', 'web-audio');
            const state = () => document.documentElement?.setAttribute('data-audio-state', this.context.state);
            this.context.onstatechange = state; state();
            this.master = this.context.createGain(); this.master.connect(this.context.destination);
            this.master.gain.value = this.muted ? 0 : 1;
            for (const bus of ['music', 'effects', 'voice', 'popup'] as AudioBus[]) {
                const gain = this.context.createGain(); gain.connect(this.master); this.buses.set(bus, gain);
            }
        }
        return this.context;
    }
    private report(name: string, error: unknown) {
        if (!this.disposed && !this.warned.has(name)) {
            this.warned.add(name); console.warn('[audio]', name, error);
        }
    }
    private buffer(name: string) {
        if (!this.buffers.has(name)) {
            const pending = this.fetchAudio((this.base || new URL('audio/', document.baseURI).href) + name + '.mp3?v=' + AUDIO_REVISION)
                .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}: ${name}`); return response.arrayBuffer(); })
                .then(data => this.ensure()?.decodeAudioData(data));
            this.buffers.set(name, pending);
            pending.catch(() => { if (this.buffers.get(name) === pending) this.buffers.delete(name); });
        }
        return this.buffers.get(name);
    }
    preload(names: string[]) {
        this.ensure();
        for (const name of names) void this.buffer(name).catch(error => this.report(name, error));
    }
    async load(names: string[], progress: () => void) {
        const results = await Promise.allSettled(names.map(async name => {
            await this.buffer(name);
            progress();
        }));
        if (results.some(result => result.status === 'rejected')) throw new Error('免费音效加载失败');
    }
    release(names: string[]) {
        for (const name of names) this.buffers.delete(name);
    }
    unlock = () => {
        const context = this.ensure();
        if (context && context.state === 'suspended' && !document.hidden)
            void context.resume().catch(error => this.report('resume', error));
    };
    private visibility = () => {
        if (document.hidden) {
            if (this.context?.state === 'running') void this.context.suspend().catch(error => this.report('suspend', error));
        } else this.unlock();
    };
    attach() {
        for (const event of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(event, this.unlock, true);
        document.addEventListener('visibilitychange', this.visibility);
    }
    setMuted(muted: boolean) {
        this.muted = muted;
        document.documentElement?.setAttribute('data-audio-muted', String(muted));
        if (this.master) this.master.gain.value = muted ? 0 : 1;
    }
    setVolume(bus: AudioBus, value: number) {
        const gain = this.buses.get(bus);
        if (gain) gain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.context.currentTime, 0.05);
    }
    play(name: string, bus: AudioBus = 'effects', options: PlayOptions = {}) {
        const context = this.ensure(); if (!context) return;
        this.trace('request', name, { bus, delay: options.delay || 0 });
        const slot = options.slot || `shot:${++this.sequence}`;
        this.stop(slot);
        const revision = this.revisions.get(slot), when = context.currentTime + (options.delay || 0);
        void this.buffer(name).then(buffer => {
            if (this.disposed || !buffer || this.revisions.get(slot) !== revision) return;
            const source = context.createBufferSource(); source.buffer = buffer;
            source.loop = !!options.loop; source.connect(this.buses.get(bus));
            this.sources.set(slot, source);
            source.onended = () => {
                source.disconnect();
                if (this.sources.get(slot) === source) {
                    this.sources.delete(slot); this.revisions.delete(slot);
                }
            };
            source.start(Math.max(context.currentTime, when));
            this.trace('start', name, { bus, slot, duration: buffer.duration, state: context.state,
                gain: this.buses.get(bus).gain.value, master: this.master.gain.value });
        }).catch(error => {
            if (this.revisions.get(slot) === revision) this.revisions.delete(slot);
            this.report(name, error);
        });
    }
    stop(slot: string) {
        this.revisions.set(slot, ++this.sequence);
        const source = this.sources.get(slot);
        if (source) this.trace('stop', slot);
        if (source) { source.onended = null; source.stop(); source.disconnect(); this.sources.delete(slot); }
    }
    destroy() {
        this.disposed = true;
        for (const event of ['pointerdown', 'touchend', 'click', 'keydown']) document.removeEventListener(event, this.unlock, true);
        document.removeEventListener('visibilitychange', this.visibility);
        for (const slot of this.sources.keys()) this.stop(slot);
        this.buffers.clear(); this.revisions.clear();
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    }
}
