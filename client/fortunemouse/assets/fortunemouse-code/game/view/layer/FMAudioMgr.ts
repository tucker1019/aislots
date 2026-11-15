import { _decorator, Component, Node, game, Game, AudioSource, AudioClip } from 'cc';
import { fmframe } from '../../../fmframe/fmframe';

import { FMConstant } from '../../FMConstant/FMConstant';
import FMLoadManager from '../../load/FMLoadManager';
import { FMConfigCtrl } from './FMConfigCtrl';


const { ccclass, property } = _decorator;

@ccclass("FMAudioMgr")
export class FMAudioMgr extends Component {

    private static _instance: FMAudioMgr = null

    public static get Instance(): FMAudioMgr {

        if (this._instance == null) {
            this._instance = new FMAudioMgr()
        }
        return this._instance
    }
    public static set Instance(_instance: FMAudioMgr) {
        this._instance = _instance
    }
    public playLongEffect(path: string) {
        fmframe.audio.playLongEffect("res/load/sound/" + path, FMConstant.BUNDLENAME)
    }
    public stopLongEffect(url: string) {
        fmframe.audio.stopEffectLong("res/load/sound/" + url)
    }
    public isMusicPlaying() {
        return fmframe.audio.isMusicPlaying()
    }

    public playMusic(path: string = null) {
        if (!path) {
            // let list = ["BGM1", "BGM2"];
            // path = list[Math.floor(Math.random() * list.length)];
            path = "bgm_mg"
        }
        fmframe.audio.playMusic("res/load/sound/" + path, FMConstant.BUNDLENAME)
    }

    public stopMusic() {
        fmframe.audio.stopMusic()
    }

    public playSound(path: string) {
        
        fmframe.audio.playEffect("res/load/sound/" + path, FMConstant.BUNDLENAME)
    }

    public stopAll() {
        fmframe.audio.stopAll()
    }
    public removeAudioRootNode() {
        fmframe.audio && fmframe.audio.removeAudioRootNode()
    }

    public resumeMusic(){
        fmframe.audio.resumeMusic();
    }

}

