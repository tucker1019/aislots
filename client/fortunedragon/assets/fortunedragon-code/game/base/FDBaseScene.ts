import { _decorator, Component } from 'cc';
import { fdframe } from '../../fdframe/fdframe';

const { ccclass } = _decorator;

@ccclass('FDBaseScene')
export abstract class FDBaseScene extends Component {
    onDestroy() {
        fdframe.message.offByTarger(this);
    }
}
