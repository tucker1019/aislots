import { _decorator, Component, assetManager, SceneAsset, director, setDisplayStats } from "cc";



const { ccclass, property } = _decorator;

let GAMENAME = 'szcw_1068wildbountyshowdown'
@ccclass('H5Main')
export class H5Main extends Component {
    start() {
        console.log("load main scene")
        setDisplayStats(false)
        assetManager.loadBundle(GAMENAME, (err, bundle) => {
            if (err) console.error(err)
            this.enterGame()
        })
    }

    enterGame() {
        assetManager.getBundle(GAMENAME).loadScene("game", (err: Error, scene: SceneAsset) => {
            if (err) console.error(err)
            director.runScene(scene)
        })
    }
}

