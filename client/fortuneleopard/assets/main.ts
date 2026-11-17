import { _decorator, Component, setDisplayStats } from 'cc';

const { ccclass } = _decorator;

/** Compatibility component for old editor scenes. The web build starts FLGameScene directly. */
@ccclass('main')
export class main extends Component {
    start() {
        setDisplayStats(false);
    }
}
