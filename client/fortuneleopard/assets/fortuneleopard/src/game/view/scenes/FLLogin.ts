import { _decorator, setDisplayStats } from 'cc';
import { FLBaseScene } from '../../base/FLBaseScene';

const { ccclass } = _decorator;

/** Legacy loading scene kept only for project compatibility. Live entry uses FLGameScene directly with REST. */
@ccclass('FLLogin')
export class FLLogin extends FLBaseScene {
    protected initAttribute() {}
    start() { setDisplayStats(false); }
}
