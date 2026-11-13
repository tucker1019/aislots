import { _decorator, Component } from 'cc';
import { wbsgame } from '../wbsgame';



const { ccclass } = _decorator;

@ccclass('WBSBaseScene')
export abstract class WBSBaseScene extends Component {
    onLoad() {}

    onDestroy() {
        wbsgame.message.offByTarger(this);
        this.unscheduleAllCallbacks();
    }
}

