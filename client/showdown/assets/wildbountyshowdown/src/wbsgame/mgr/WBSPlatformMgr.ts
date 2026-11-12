import { Component, _decorator } from 'cc';
import { wbsgame } from '../wbsgame';
import { WBSConfig } from '../cfg/WBSConfig';
const { ccclass } = _decorator;
@ccclass('WBSPlatformMgr')
export class WBSPlatformMgr extends Component {
    initConfig() {
        const params = new URLSearchParams(location.search);
        WBSConfig.lang = params.get('lang') || 'en';
        wbsgame.storageMgr.setUserAndGameId('AG3', 3);
    }
    exitToPlatform() { if (window.parent !== window) {
        window.parent.postMessage({ type: 'aislots:exit', gameId: 'AG3' }, '*');
    }
    else
        location.assign('/'); }
    exitToLogin() { this.exitToPlatform(); }
    refreshCoin() { }
    loadingHide() { window.dispatchEvent(new Event('aislots-board-ready')); }
    getLanguage() { return WBSConfig.lang; }
}
