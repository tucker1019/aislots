import { _decorator, assetManager, Director, director, game, ResolutionPolicy, screen, setDisplayStats, view } from 'cc';
import { ftframe } from '../../../ftframe/ftframe';
import { FTAudioManager } from '../../../ftframe/audio/FTAudioManager';
import { FTBaseScene } from '../../base/FTBaseScene';
import { FTConstant } from '../../FTConstant/FTConstant';
import FTLoadManager from '../../load/FTLoadManager';
import { FTGameManager } from '../../mgr/FTGameManager';
import { goSession } from '../../net/FTGoSession';
import { FTGlobal } from '../layer/FTGlobal';
import GameBridge from '../../../../../game.bridge';
const { ccclass } = _decorator;

@ccclass('FTGame')
export class FTGame extends FTBaseScene {
    protected initAttribute() {}

    async start() {
        setDisplayStats(false);
        game.frameRate = 59;
        GameBridge.init(window.parent);
        const fit = () => {
            const size = screen.windowSize;
            const policy = size.width / size.height > 750 / 1334 ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
            if (FTGlobal.ADAPTATION !== policy) {
                FTGlobal.ADAPTATION = policy;
                view.setDesignResolutionSize(750, 1334, policy);
            }
        };
        view.setResizeCallback(fit);
        fit();
        const params = new URLSearchParams(location.search);
        const lang = params.get('lang');
        if (lang === 'br' || lang === 'pt-BR') FTGlobal.LANG = 'br';
        FTConstant.languagePath = `res/load/image/language/${FTGlobal.LANG}/`;
        FTGlobal.debugLog = false;
        const emit = (name: string, progress?: number) => window.dispatchEvent(new CustomEvent(name, { detail:{progress} }));
        const enable = () => {
            for (const name of ['SafeLayer', 'TopLayer', 'GameLayer']) this.node.getChildByName(name).active = true;
            director.once(Director.EVENT_AFTER_DRAW, () => {
                if (this.isValid) emit('aislots-game-revealed');
            });
        };
        requestAnimationFrame(() => emit('aislots-scene-rendered'));
        try {
            const preload = (async () => {
                await new Promise<void>((resolve, reject) => {
                    if (assetManager.getBundle(FTConstant.BUNDLENAME)) { resolve(); return; }
                    assetManager.loadBundle(FTConstant.BUNDLENAME, err => err ? reject(err) : resolve());
                });
                if (!FTLoadManager.ins.init()) throw new Error('Game bundle unavailable');
                await new Promise<void>((resolve, reject) => FTLoadManager.ins.preLoadDir(
                    (done, total) => emit('aislots-loading-progress', total ? 5 + 89 * done / total : 5),
                    err => err ? reject(err) : resolve()));
            })();
            await Promise.all([preload, this.initGo()]);
            if (document.getElementById('AG4LoadingCover')) {
                window.addEventListener('aislots-started', enable, { once: true });
                emit('aislots-board-ready');
            } else enable();
        } catch (error) {
            const button = document.getElementById('AG4StartButton') as HTMLButtonElement;
            if (!button) { console.error(error); return; }
            button.textContent = 'RETRY';
            button.title = error.message;
            button.setAttribute('aria-label', '重试：' + error.message);
            button.onclick = () => location.reload();
            button.hidden = false;
        }
    }

    private async initGo() {
        FTGlobal.isPoint = 1;
        ftframe.audio = FTAudioManager.instance;
        const params = new URLSearchParams(location.search);
        const replay = params.get('replay');
        if (replay) {
            const data = await goSession.readReplay(replay, params.get('share'));
            goSession.entry = { replay: data };
            FTGameManager.setMultiples([data.betAmount / 5]);
            FTGameManager.setAllMultiples([data.betAmount]);
        } else {
            const data = await goSession.connect();
            goSession.entry = { live: data };
            FTGlobal.USER.uid = data.uid;
            FTGlobal.USER.gold = data.state.balance;
            FTGlobal.coinSymbol = data.policy.currency;
            FTGameManager.setGoBetLevels(data.policy.betLevel);
            FTGameManager.setMultiples(data.policy.betOptions.map(Number));
            FTGameManager.setAllMultiples(data.policy.betOptions.map(bet => Number(bet) * 5));
        }
        FTGameManager.setTotalBitList();
    }
}
