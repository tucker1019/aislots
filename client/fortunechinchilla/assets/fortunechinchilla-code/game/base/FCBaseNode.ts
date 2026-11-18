import { _decorator, Component } from 'cc';
import { fcframe } from '../../fcframe/fcframe';


const { ccclass } = _decorator;

@ccclass('FCBaseNode')
export abstract class FCBaseNode extends Component {

    onLoad() {
    }

   async delayTime(time: number):Promise<void> {
        return new Promise((rej)=>{
            this.scheduleOnce(()=>{rej()},time)
        })
    }
    onDestroy() {
        fcframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

