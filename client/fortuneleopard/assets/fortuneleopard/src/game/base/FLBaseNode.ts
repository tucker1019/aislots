import { _decorator, Component } from 'cc';
import { flframe } from '../../flframe/flframe';


const { ccclass } = _decorator;

@ccclass('FLBaseNode')
export abstract class FLBaseNode extends Component {

    onLoad() {
    }

   async delayTime(time: number):Promise<void> {
        return new Promise((rej)=>{
            this.scheduleOnce(()=>{rej()},time)
        })
    }
    onDestroy() {
        flframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

