import { FOXAudioManager } from "./audio/FOXAudioManager";
import { FOXEventManager } from "./event/FOXEventManager";
import { FOXResLoader } from "./loader/FOXResLoader";
import { FOXLogger } from "./log/FOXLogger";
import { FOXStorageManager } from "./storage/FOXStorageManager";

export class foxframe {

    static log = FOXLogger;
 

    static res = new FOXResLoader();

    static get message(): FOXEventManager {
        return FOXEventManager.Instance;
    }
    /** 本地存储 */
    static storage = FOXStorageManager;

    /** 游戏音乐管理 */
    static audio: FOXAudioManager
}