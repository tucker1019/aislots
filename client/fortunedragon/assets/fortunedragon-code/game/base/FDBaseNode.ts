import { _decorator, Component } from 'cc';
import { fdframe } from '../../fdframe/fdframe';


const { ccclass } = _decorator;

@ccclass('FDBaseNode')
export abstract class FDBaseNode extends Component {

    onLoad() {
    }

   async delayTime(time: number):Promise<void> {
        return new Promise((rej)=>{
            this.scheduleOnce(()=>{rej()},time)
        })
    }
    onDestroy() {
        fdframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

