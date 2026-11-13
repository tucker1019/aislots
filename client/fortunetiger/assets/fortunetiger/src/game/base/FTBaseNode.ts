import { _decorator, Component } from 'cc';
import { ftframe } from '../../ftframe/ftframe';

import FTNetController from '../net/FTNetController';

const { ccclass } = _decorator;

@ccclass('FTBaseNode')
export abstract class FTBaseNode extends Component {

    onLoad() {
    }

   async delayTime(time: number):Promise<void> {
        return new Promise((rej)=>{
            this.scheduleOnce(()=>{rej()},time)
        })
    }
    onDestroy() {
        let Node = FTNetController.netNode;
        Node.removeResponeHandlerByTarget(this);
        ftframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

