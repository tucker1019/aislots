import { _decorator, Component } from 'cc';
import { ftframe } from '../../ftframe/ftframe';


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
        ftframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

