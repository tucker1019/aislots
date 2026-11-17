import { FLAudioManager } from "./audio/FLAudioManager";
import { FLEventManager } from "./event/FLEventManager";
import { FLResLoader } from "./loader/FLResLoader";
import { FLLogger } from "./log/FLLogger";
import { FLStorageManager } from "./storage/FLStorageManager";

export class flframe {

    static log = FLLogger;
 

    static res = new FLResLoader();

    static get message(): FLEventManager {
        return FLEventManager.Instance;
    }
    /** 本地存储 */
    static storage = FLStorageManager;

    /** 游戏音乐管理 */
    static audio: FLAudioManager
}