import { _decorator, Component } from 'cc';
import { fmframe } from '../../fmframe/fmframe';


const { ccclass } = _decorator;

@ccclass('FMBaseNode')
export abstract class FMBaseNode extends Component {

    onLoad() {
    }

   async delayTime(time: number):Promise<void> {
        return new Promise((rej)=>{
            this.scheduleOnce(()=>{rej()},time)
        })
    }
    onDestroy() {
        fmframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

