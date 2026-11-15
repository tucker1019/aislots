import { _decorator, Component } from 'cc';
import { foxframe } from '../../foxframe/foxframe';


const { ccclass } = _decorator;

@ccclass('FOXBaseNode')
export abstract class FOXBaseNode extends Component {

    onLoad() {
    }

   async delayTime(time: number):Promise<void> {
        return new Promise((rej)=>{
            this.scheduleOnce(()=>{rej()},time)
        })
    }
    onDestroy() {
        foxframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

