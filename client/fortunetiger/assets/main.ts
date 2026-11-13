import { _decorator, Component, Node, assetManager, UI, Scene, director, setDisplayStats, find, SpriteFrame, Sprite, game } from 'cc';
import GameBridge from './game.bridge';

const { ccclass, property } = _decorator;

let GAMENAME = 'szcw_1017fortunetiger'


@ccclass('main')
export class main extends Component {
    @property([SpriteFrame])
    sps: SpriteFrame[] = [];
    start() {
        game.frameRate = 59;
        console.log("load main scene")
        GameBridge.init(top);
        GameBridge.callNoReturnValue('LOADING_HIDE');
        setDisplayStats(false)
        assetManager.loadBundle(GAMENAME, (err, bundle) => {
            this.enterGame()
        })
    }
    enterGame() {
        assetManager.getBundle(GAMENAME).loadScene("game", (err, scene) => {
            director.runScene(scene)
        })

    }
}

// export let FTGlobal_ma = {
//     Exit_selt : false
// }

