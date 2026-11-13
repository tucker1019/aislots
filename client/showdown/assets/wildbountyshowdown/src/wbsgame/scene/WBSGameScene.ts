import { _decorator, Node, setDisplayStats } from 'cc';
import { WBSBaseScene } from '../base/WBSBaseScene';
import { wbsgame } from '../wbsgame';
import { bootstrapScene } from '../../network/scene_bootstrap';

const { ccclass, executionOrder } = _decorator;

@ccclass('WBSGameScene')
@executionOrder(-10000)
export class WBSGameScene extends WBSBaseScene {
    private presentation: { node: Node; active: boolean }[] = [];

    onLoad(): void {
        setDisplayStats(false);
        // Keep the existing hierarchy, but defer child scripts until data is ready.
        for (const node of this.node.children) {
            if (node.name === 'Camera') continue;
            this.presentation.push({ node, active: node.active });
            node.active = false;
        }
        const managers = new Node('mgr');
        this.node.scene.addChild(managers);
        managers.addComponent(wbsgame);
        wbsgame.platformMgr.initConfig();
        wbsgame.gameMgr.setUserData({
            musicSwitch: wbsgame.storageMgr.get('musicSwitch', 'true') === 'true',
            soundSwitch: wbsgame.storageMgr.get('soundSwitch', 'true') === 'true',
        });
        super.onLoad();
        window.dispatchEvent(new CustomEvent('aislots-loading-progress', { detail: { progress: 10 } }));
    }

    async start(): Promise<void> {
        await wbsgame.sendMgr.retry(() => bootstrapScene({
            session: () => wbsgame.sendMgr.bootstrap(),
            resources: () => new Promise<void>((resolve, reject) => {
                wbsgame.loadMgr.preLoadDir((completed, total) => {
                    window.dispatchEvent(new CustomEvent('aislots-loading-progress', { detail: { progress: 10 + 75 * completed / Math.max(1, total) } }));
                }, error => error ? reject(error) : resolve());
            }),
            isAlive: () => this.isValid,
            ready: () => {
                for (const entry of this.presentation) entry.node.active = entry.active;
                window.dispatchEvent(new CustomEvent('aislots-loading-progress', { detail: { progress: 95 } }));
            },
        }));
    }
}
