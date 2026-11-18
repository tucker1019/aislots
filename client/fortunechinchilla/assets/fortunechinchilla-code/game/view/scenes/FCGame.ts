import { _decorator, Asset, Director, director, ResolutionPolicy, screen, setDisplayStats, UITransform, view } from 'cc';
import { fcframe } from '../../../fcframe/fcframe';
import { FCAudioManager } from '../../../fcframe/audio/FCAudioManager';
import { FCBaseScene } from '../../base/FCBaseScene';
import { FCConstant } from '../../FCConstant/FCConstant';
import FCLoadManager from '../../load/FCLoadManager';
import { goSession } from '../../net/FCGoSession';
import { exitGame, promptGame } from '../../net/FCGameUI';
import { FCGameLayerCtrl } from '../layer/FCGameLayerCtrl';
import { FCGlobal } from '../layer/FCGlobal';

const { ccclass } = _decorator;

@ccclass('FCGame')
export class FCGame extends FCBaseScene {
    protected initAttribute() {}

    private emit(name: string, progress?: number) {
        window.dispatchEvent(new CustomEvent(name, {detail: {progress}}));
    }

    private fittedPolicy?: number;
    private preloadedAssets: Asset[] = [];

    private fit = () => {
        const {width, height} = screen.windowSize;
        if (!width || !height) return;
        const policy = width / height > 750 / 1334 ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
        FCGlobal.ADAPTATION = policy;
        if (this.fittedPolicy !== policy) {
            this.fittedPolicy = policy;
            view.setDesignResolutionSize(750, 1334, policy);
        }
        const background = this.node.getChildByName('lauch1');
        const size = background.getComponent(UITransform).contentSize;
        const visible = view.getVisibleSize();
        const scale = Math.max(visible.width / size.width, visible.height / size.height);
        background.setScale(scale, scale);
    };

    async start() {
        setDisplayStats(false);
        view.setResizeCallback(this.fit);
        this.fit();
        fcframe.audio = FCAudioManager.instance;
        const lang = new URLSearchParams(location.search).get('lang');
        FCGlobal.LANG = lang?.startsWith('id') ? 'id' : lang?.startsWith('es') ? 'es' : 'en';
        FCGlobal.COUNTRYCODE = 'ID';
        FCGlobal.isPoint = 1;
        FCGlobal.debugLog = false;
        FCConstant.languagePath = `res/load/image/language/${FCGlobal.LANG}/`;

        director.once(Director.EVENT_AFTER_DRAW, () => {
            if (this.isValid) this.emit('aislots-scene-rendered');
        });
        try {
            await Promise.all([goSession.connect(), this.preload()]);
            if (!this.isValid) return;
            if (document.getElementById('AG10LoadingCover')) {
                window.addEventListener('aislots-started', this.enter, {once:true});
                this.emit('aislots-board-ready');
            } else this.enter();
        } catch (error) {
            if (!this.isValid) return;
            this.emit('aislots-loading-failed');
            const message = error.status === 401 ? 'Sesi berakhir. Silakan masuk kembali dari lobi.' : 'Gagal memuat game. Silakan coba lagi.';
            const actions = [{label: 'Kembali ke lobi', run: exitGame}];
            if (error.status !== 401) actions.unshift({label: 'Coba lagi', run: () => location.reload()});
            promptGame('Gagal Membuka Game', message, actions);
            console.error('[AG10] entry', error);
        }
    }

    private enter = () => {
        // Allow the full viewport launch image to paint before enabling Cocos gameplay.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!this.isValid) return;
            const layer = this.node.getChildByName('GameLayer');
            for (const name of ['SafeLayer', 'TopLayer']) this.node.getChildByName(name).active = true;
            const game = layer.getComponent(FCGameLayerCtrl);
            game.afterFirstBoardDraw = () => this.emit('aislots-game-revealed');
            layer.active = true;
        }));
    };

    private async preload() {
        await new Promise<void>((resolve, reject) => {
            FCLoadManager.ins.preLoadDir((done, total) => {
                if (this.isValid && total > 0) this.emit('aislots-loading-progress', 5 + 94 * done / total);
            }, (error, assets) => {
                if (error) { reject(error); return; }
                // Dynamic prefabs must stay cached while the cover waits for START.
                if (this.isValid) this.preloadedAssets = assets.map(asset => asset.addRef());
                resolve();
            });
        });
    }

    onDestroy() {
        window.removeEventListener('aislots-started', this.enter);
        view.setResizeCallback(null);
        for (const asset of this.preloadedAssets) asset.decRef();
        this.preloadedAssets = [];
        super.onDestroy();
    }
}
