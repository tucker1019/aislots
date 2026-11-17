import { _decorator, Component, Node, game, Game, AudioSource, AudioClip } from 'cc';
import { flframe } from '../../../flframe/flframe';

import { FLConstant } from '../../FLConstant/FLConstant';
import FLLoadManager from '../../load/FLLoadManager';
import { FLConfigCtrl } from './FLConfigCtrl';


const { ccclass, property } = _decorator;

@ccclass("FLAudioMgr")
export class FLAudioMgr extends Component {

    private static _instance: FLAudioMgr = null

    public static get Instance(): FLAudioMgr {

        if (this._instance == null) {
            this._instance = new FLAudioMgr()
        }
        return this._instance
    }
    public static set Instance(_instance: FLAudioMgr) {
        this._instance = _instance
    }
    public playLongEffect(path: string) {
        flframe.audio.playLongEffect("res/load/sound/" + path, FLConstant.BUNDLENAME)
    }
    public stopLongEffect(url: string) {
        flframe.audio.stopEffectLong("res/load/sound/" + url)
    }
    public isMusicPlaying() {
        return flframe.audio.isMusicPlaying()
    }

    public playMusic(path: string = null) {
        if (!path) {
            // let list = ["BGM1", "BGM2"];
            // path = list[Math.floor(Math.random() * list.length)];
            path = "bgm_mg"
        }
        flframe.audio.playMusic("res/load/sound/" + path, FLConstant.BUNDLENAME)
    }

    public stopMusic() {
        flframe.audio.stopMusic()
    }

    public playSound(path: string) {
    
        flframe.audio.playEffect("res/load/sound/" + path, FLConstant.BUNDLENAME)
    }

    public stopAll() {
        flframe.audio.stopAll()
    }
    public removeAudioRootNode() {
        flframe.audio && flframe.audio.removeAudioRootNode()
    }

    public resumeMusic(){
        flframe.audio.resumeMusic();
    }

}

