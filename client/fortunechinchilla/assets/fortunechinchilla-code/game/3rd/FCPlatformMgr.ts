import { FCGlobal } from '../view/layer/FCGlobal';
import { exitGame, toast } from '../net/FCGameUI';

export class FCPlatformMgr {
    static getLanguage() { return FCGlobal.LANG; }
    static exitToPlatform() { exitGame(); }
    static exitToLogin() { exitGame(); }
    static isLineEnv() { return false; }
    static pay(_openType = 1) { toast('Silakan kembali ke lobi untuk deposit.'); }
    static toVip() { toast('Silakan kembali ke lobi untuk melihat VIP.'); }
}
