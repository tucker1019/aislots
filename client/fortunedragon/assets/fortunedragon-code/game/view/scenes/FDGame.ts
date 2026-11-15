import { _decorator, Asset, Director, director, ResolutionPolicy, screen, setDisplayStats, view } from 'cc';
import { fdframe } from '../../../fdframe/fdframe';
import { FDAudioManager } from '../../../fdframe/audio/FDAudioManager';
import { FDBaseScene } from '../../base/FDBaseScene';
import FDLoadManager from '../../load/FDLoadManager';
import { goSession } from '../../net/FDGoSession';
import { exitGame, promptGame } from '../../net/FDGameUI';
import { FDGameLayerCtrl } from '../layer/FDGameLayerCtrl';
import { FDGlobal } from '../layer/FDGlobal';

const { ccclass } = _decorator;

@ccclass('FDGame')
export class FDGame extends FDBaseScene {
    protected initAttribute() {}

    onLoad() {
        // Creator can show this layer while editing; runtime waits for START.
        this.node.getChildByName('GameLayer').active = false;
    }

    private emit(name: string, progress?: number) {
        window.dispatchEvent(new CustomEvent(name, {detail: {progress}}));
    }

    private fittedPolicy?: number;
    private preloadedAssets: Asset[] = [];

    private fit = () => {
        const {width, height} = screen.windowSize;
        if (!width || !height) return;
        const policy = width / height > 750 / 1334 ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
        FDGlobal.ADAPTATION = policy;
        if (this.fittedPolicy !== policy) {
            this.fittedPolicy = policy;
            view.setDesignResolutionSize(750, 1334, policy);
        }

    };

    async start() {
        setDisplayStats(false);
        view.setResizeCallback(this.fit);
        this.fit();
        fdframe.audio = FDAudioManager.instance;
        const lang = new URLSearchParams(location.search).get('lang');
        FDGlobal.LANG = lang?.startsWith('pt') || lang === 'br' ? 'br' : 'en';
        FDGlobal.COUNTRYCODE = 'ID';
        FDGlobal.debugLog = false;

        director.once(Director.EVENT_AFTER_DRAW, () => {
            if (this.isValid) this.emit('aislots-scene-rendered');
        });
        try {
            await Promise.all([goSession.connect(), this.preload()]);
            if (!this.isValid) return;
            if (document.getElementById('AG8LoadingCover')) {
                window.addEventListener('aislots-started', this.enter, {once:true});
                this.emit('aislots-board-ready');
            } else this.enter();
        } catch (error) {
            if (!this.isValid) return;
            this.emit('aislots-loading-failed');
            const message = error.status === 401 ? '登录已过期，请从大厅重新进入。' : '游戏加载失败，请重试。';
            const actions = [{label: '返回大厅', run: exitGame}];
            if (error.status !== 401) actions.unshift({label: '重试', run: () => location.reload()});
            promptGame('无法进入游戏', message, actions);
            console.error('[AG8] entry', error);
        }
    }

    private enter = () => {
        // Allow the full viewport launch image to paint before enabling Cocos gameplay.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!this.isValid) return;
            const layer = this.node.getChildByName('GameLayer');
            for (const name of ['SafeLayer', 'TopLayer']) this.node.getChildByName(name).active = true;
            const game = layer.getComponent(FDGameLayerCtrl);
            game.afterFirstBoardDraw = () => this.emit('aislots-game-revealed');
            layer.active = true;
        }));
    };

    private async preload() {
        await new Promise<void>((resolve, reject) => {
            FDLoadManager.ins.preLoadDir((done, total) => {
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
