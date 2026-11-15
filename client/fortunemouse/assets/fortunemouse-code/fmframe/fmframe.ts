import { FMAudioManager } from "./audio/FMAudioManager";
import { FMEventManager } from "./event/FMEventManager";
import { FMResLoader } from "./loader/FMResLoader";
import { FMLogger } from "./log/FMLogger";
import { FMStorageManager } from "./storage/FMStorageManager";

export class fmframe {

    static log = FMLogger;
 

    static res = new FMResLoader();

    static get message(): FMEventManager {
        return FMEventManager.Instance;
    }
    /** 本地存储 */
    static storage = FMStorageManager;

    /** 游戏音乐管理 */
    static audio: FMAudioManager
}