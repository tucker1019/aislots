import { FCAudioManager } from "./audio/FCAudioManager";
import { FCEventManager } from "./event/FCEventManager";
import { FCResLoader } from "./loader/FCResLoader";
import { FCLogger } from "./log/FCLogger";
import { FCStorageManager } from "./storage/FCStorageManager";

export class fcframe {

    static log = FCLogger;
 

    static res = new FCResLoader();

    static get message(): FCEventManager {
        return FCEventManager.Instance;
    }
    /** 本地存储 */
    static storage = FCStorageManager;

    /** 游戏音乐管理 */
    static audio: FCAudioManager
}