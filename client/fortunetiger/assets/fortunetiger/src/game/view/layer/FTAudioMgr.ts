import { _decorator, Component, Node, game, Game, AudioSource, AudioClip } from 'cc';
import { ftframe } from '../../../ftframe/ftframe';

import { FTConstant } from '../../FTConstant/FTConstant';
import FTLoadManager from '../../load/FTLoadManager';
import { FTConfigCtrl } from './FTConfigCtrl';


const { ccclass, property } = _decorator;

@ccclass("FTAudioMgr")
export class FTAudioMgr extends Component {

    private static _instance: FTAudioMgr = null

    public static get Instance(): FTAudioMgr {

        if (this._instance == null) {
            this._instance = new FTAudioMgr()
        }
        return this._instance
    }
    public static set Instance(_instance: FTAudioMgr) {
        this._instance = _instance
    }
    public playLongEffect(path: string) {
        ftframe.audio.playLongEffect("fortunetiger/res/load/sound/" + path, FTConstant.BUNDLENAME)
    }
    public stopLongEffect(url: string) {
        ftframe.audio.stopEffectLong("fortunetiger/res/load/sound/" + url)
    }
    public isMusicPlaying() {
        return ftframe.audio.isMusicPlaying()
    }

    public playMusic(path: string = null) {
        if (!path) {
            // let list = ["BGM1", "BGM2"];
            // path = list[Math.floor(Math.random() * list.length)];
            path = "bgm_mg"
        }
        ftframe.audio.playMusic("fortunetiger/res/load/sound/" + path, FTConstant.BUNDLENAME)
    }

    public stopMusic() {
        ftframe.audio.stopMusic()
    }

    public playSound(path: string) {
    
        ftframe.audio.playEffect("fortunetiger/res/load/sound/" + path, FTConstant.BUNDLENAME)
    }

    public stopAll() {
        ftframe.audio.stopAll()
    }
    public removeAudioRootNode() {
        ftframe.audio && ftframe.audio.removeAudioRootNode()
    }

    public resumeMusic(){
        ftframe.audio.resumeMusic();
    }

}

