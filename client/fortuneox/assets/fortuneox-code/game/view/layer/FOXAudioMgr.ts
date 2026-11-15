import { _decorator, Component, Node, game, Game, AudioSource, AudioClip } from 'cc';
import { foxframe } from '../../../foxframe/foxframe';

import { FOXConstant } from '../../FOXConstant/FOXConstant';
import FOXLoadManager from '../../load/FOXLoadManager';
import { FOXConfigCtrl } from './FOXConfigCtrl';


const { ccclass, property } = _decorator;

@ccclass("FOXAudioMgr")
export class FOXAudioMgr extends Component {

    private static _instance: FOXAudioMgr = null

    public static get Instance(): FOXAudioMgr {

        if (this._instance == null) {
            this._instance = new FOXAudioMgr()
        }
        return this._instance
    }
    public static set Instance(_instance: FOXAudioMgr) {
        this._instance = _instance
    }
    public playLongEffect(path: string) {
        foxframe.audio.playLongEffect("res/load/sound/" + path, FOXConstant.BUNDLENAME)
    }
    public stopLongEffect(url: string) {
        foxframe.audio.stopEffectLong("res/load/sound/" + url)
    }
    public isMusicPlaying() {
        return foxframe.audio.isMusicPlaying()
    }

    public playMusic(path: string = null) {
        if (!path) {
            // let list = ["BGM1", "BGM2"];
            // path = list[Math.floor(Math.random() * list.length)];
            path = "bgm_mg"
        }
        foxframe.audio.playMusic("res/load/sound/" + path, FOXConstant.BUNDLENAME)
    }

    public stopMusic() {
        foxframe.audio.stopMusic()
    }

    public playSound(path: string) {
    
        foxframe.audio.playEffect("res/load/sound/" + path, FOXConstant.BUNDLENAME)
    }

    public stopAll() {
        foxframe.audio.stopAll()
    }
    public removeAudioRootNode() {
        foxframe.audio && foxframe.audio.removeAudioRootNode()
    }

    public resumeMusic(){
        foxframe.audio.resumeMusic();
    }

}

