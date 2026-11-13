import { FTAudioManager } from "./audio/FTAudioManager";
import { FTEventManager } from "./event/FTEventManager";
import { FTResLoader } from "./loader/FTResLoader";
import { FTLogger } from "./log/FTLogger";
import { FTStorageManager } from "./storage/FTStorageManager";

export class ftframe {

    static log = FTLogger;
 

    static res = new FTResLoader();

    static get message(): FTEventManager {
        return FTEventManager.Instance;
    }
    /** 本地存储 */
    static storage = FTStorageManager;

    /** 游戏音乐管理 */
    static audio: FTAudioManager
}