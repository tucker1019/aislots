import { _decorator, Component } from 'cc';
import { frframe } from '../../frframe/frframe';


const { ccclass } = _decorator;

@ccclass('FRBaseNode')
export abstract class FRBaseNode extends Component {

    onLoad() {
    }

   async delayTime(time: number):Promise<void> {
        return new Promise((rej)=>{
            this.scheduleOnce(()=>{rej()},time)
        })
    }
    onDestroy() {
        frframe.message.offByTarger(this);
    }
    protected abstract initAttribute(): void;
}

