import { FRAudioManager } from "./audio/FRAudioManager";
import { FREventManager } from "./event/FREventManager";
import { FRResLoader } from "./loader/FRResLoader";
import { FRLogger } from "./log/FRLogger";
import { FRStorageManager } from "./storage/FRStorageManager";

export class frframe {

    static log = FRLogger;
 

    static res = new FRResLoader();

    static get message(): FREventManager {
        return FREventManager.Instance;
    }
    /** 本地存储 */
    static storage = FRStorageManager;

    /** 游戏音乐管理 */
    static audio: FRAudioManager
}