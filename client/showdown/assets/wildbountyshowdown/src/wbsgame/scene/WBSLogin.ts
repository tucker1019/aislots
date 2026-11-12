import { _decorator, Asset, director, Label, Node, ProgressBar, sp } from 'cc';
import { WBSBaseScene } from '../base/WBSBaseScene';
import { wbsgame } from '../wbsgame';
import { WBSConfig } from '../cfg/WBSConfig';
const { ccclass, property } = _decorator;
@ccclass('Login')
export class Login extends WBSBaseScene {
    @property(ProgressBar)
    bar: ProgressBar = null;
    @property(Label)
    rateLab: Label = null;
    @property(Label)
    tipLab: Label = null;
    @property(sp.Skeleton)
    skeleton: sp.Skeleton = null;
    onLoad() { const node = new Node('mgr'); node.addComponent(wbsgame); director.addPersistRootNode(node); super.onLoad(); }
    async start() {
        wbsgame.platformMgr.initConfig();
        wbsgame.gameMgr.setUserData({ musicSwitch: wbsgame.storageMgr.get('musicSwitch', 'true') === 'true', soundSwitch: wbsgame.storageMgr.get('soundSwitch', 'true') === 'true' });
        this.tipLab.string = '';
        this.skeleton.setAnimation(0, '1', false);
        this.skeleton.setCompleteListener(() => this.skeleton.setAnimation(0, 'xh', true));
        try {
            await Promise.all([wbsgame.sendMgr.bootstrap(), new Promise<void>((resolve, reject) => wbsgame.loadMgr.preLoadDir((done: number, total: number) => { this.bar.progress = done / total; this.rateLab.string = Math.round(done / total * 100) + '%'; }, (error: Error, _assets: Asset[]) => error ? reject(error) : resolve()))]);
            if (this.isValid)
                wbsgame.loadMgr.loadScene('WBSGameScene');
        }
        catch (error) {
            if (this.isValid)
                wbsgame.loadMgr.showAlert(error instanceof Error ? error.message : 'Unable to load game', () => wbsgame.platformMgr.exitToPlatform());
        }
    }
}
