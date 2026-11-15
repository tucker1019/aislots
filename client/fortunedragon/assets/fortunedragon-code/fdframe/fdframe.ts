import { FDAudioManager } from "./audio/FDAudioManager";
import { FDEventManager } from "./event/FDEventManager";
import { FDResLoader } from "./loader/FDResLoader";
import { FDLogger } from "./log/FDLogger";
import { FDStorageManager } from "./storage/FDStorageManager";

export class fdframe {

    static log = FDLogger;
 

    static res = new FDResLoader();

    static get message(): FDEventManager {
        return FDEventManager.Instance;
    }
    /** 本地存储 */
    static storage = FDStorageManager;

    /** 游戏音乐管理 */
    static audio: FDAudioManager
}