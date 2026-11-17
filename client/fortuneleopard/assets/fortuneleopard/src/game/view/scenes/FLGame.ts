import { receiveNativeReplay } from '../../history/native_replay_bridge';
import { _decorator, assetManager, Director, director, game, ResolutionPolicy, screen, setDisplayStats, view } from 'cc';
import { flframe } from '../../../flframe/flframe';
import { FLAudioManager } from '../../../flframe/audio/FLAudioManager';
import { FLBaseScene } from '../../base/FLBaseScene';
import { FLConstant } from '../../FLConstant/FLConstant';
import FLLoadManager from '../../load/FLLoadManager';
import { FLGameManager } from '../../mgr/FLGameManager';
import { goSession } from '../../net/FLGoSession';
import { FLGlobal } from '../layer/FLGlobal';
const { ccclass } = _decorator;

@ccclass('FLGame')
export class FLGame extends FLBaseScene {
    protected initAttribute() {}

    async start() {
        setDisplayStats(false);
        game.frameRate = 59;
        const fit = () => {
            const size = screen.windowSize;
            const policy = size.width / size.height > 750 / 1334 ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
            if (FLGlobal.ADAPTATION !== policy) {
                FLGlobal.ADAPTATION = policy;
                view.setDesignResolutionSize(750, 1334, policy);
            }
        };
        view.setResizeCallback(fit);
        fit();
        const params = new URLSearchParams(location.search);
        const lang = params.get('lang');
        if (lang === 'br' || lang === 'pt-BR') FLGlobal.LANG = 'br';
        FLConstant.languagePath = `res/load/image/language/${FLGlobal.LANG}/`;
        FLGlobal.debugLog = false;
        const emit = (name: string, progress?: number) => window.dispatchEvent(new CustomEvent(name, { detail:{progress} }));
        const enable = () => {
            // In FLGameScene, GameLayer is a child of Canvas and SafeLayer is
            // inside GameLayer. The previous flat lookup was copied from the
            // old scene and crashed when the start button dispatched this event.
            const gameLayer = this.node.getChildByName('GameLayer');
            if (!gameLayer) throw new Error('AG9 scene missing GameLayer');
            gameLayer.active = true;
            const safeLayer = gameLayer.getChildByName('SafeLayer');
            if (safeLayer) safeLayer.active = true;
            // Reveal the board after the first post-start render. The old
            // port used a misspelled event constant, so MULAI dispatched
            // successfully but the cover was never removed.
            director.once(Director.EVENT_AFTER_DRAW, () => {
                if (this.isValid) emit('aislots-game-revealed');
            });
        };
        requestAnimationFrame(() => emit('aislots-scene-rendered'));
        try {
            const preload = (async () => {
                // FLGameScene is the build entry. Its assets are part of the main
                // bundle, so never load a per-game Bundle here.
                if (!FLLoadManager.ins.init()) throw new Error('Game resources unavailable');
                await new Promise<void>((resolve, reject) => FLLoadManager.ins.preLoadDir(
                    (done, total) => emit('aislots-loading-progress', total ? 5 + 89 * done / total : 5),
                    err => err ? reject(err) : resolve()));
            })();
            await Promise.all([preload, this.initGo()]);
            if (document.getElementById('AG9LoadingCover')) {
                window.addEventListener('aislots-started', enable, { once: true });
                emit('aislots-board-ready');
            } else enable();
        } catch (error) {
            const status = typeof error === 'object' && error !== null && 'status' in error
                ? Number((error as { status?: unknown }).status) : 0;
            if (status === 401) {
                // The iframe must not retry the same expired launch ticket.
                goSession?.expireLaunch();
                window.parent.postMessage({ type: 'aislots:session-expired', gameId: 'AG9' }, '*');
            }
            const button = document.getElementById('AG9StartButton') as HTMLButtonElement;
            if (!button) { console.error(error); return; }
            button.textContent = 'RETRY';
            button.title = error.message;
            button.setAttribute('aria-label', '重试：' + error.message);
            button.onclick = () => location.reload();
            button.hidden = false;
        }
    }

    private async initGo() {
        FLGlobal.isPoint = 1;
        flframe.audio = FLAudioManager.instance;
        const params = new URLSearchParams(location.search);
        const replay = params.get('replay');
        const nativeReplay = params.get('nativeReplay');
        if (replay || nativeReplay) {
            const data = nativeReplay
                ? goSession.prepareReplay(await receiveNativeReplay(nativeReplay))
                : await goSession.readReplay(replay, params.get('share'));
            goSession.entry = { replay: data };
            FLGameManager.setMultiples([data.betAmount / 5]);
            FLGameManager.setAllMultiples([data.betAmount]);
        } else {
            const data = await goSession.connect();
            goSession.entry = { live: data };
            FLGlobal.USER.uid = data.uid;
            FLGlobal.USER.gold = data.state.balance;
            FLGlobal.coinSymbol = data.policy.currency;
            FLGameManager.setGoBetLevels(data.policy.betLevel);
            FLGameManager.setMultiples(data.policy.betOptions.map(Number));
            FLGameManager.setAllMultiples(data.policy.betOptions.map(bet => Number(bet) * 5));
        }
        FLGameManager.setTotalBitList();
    }
}
