import { FRGlobal } from '../view/layer/FRGlobal';
import { exitGame, toast } from '../net/FRGameUI';

export class FRPlatformMgr {
    static getLanguage() { return FRGlobal.LANG; }
    static exitToPlatform() { exitGame(); }
    static exitToLogin() { exitGame(); }
    static isLineEnv() { return false; }
    static pay(_openType = 1) { toast('请返回大厅充值。'); }
    static toVip() { toast('请返回大厅查看 VIP。'); }
}
