import { _decorator, Component, Node, game, Game, AudioSource, AudioClip } from 'cc';
import { fcframe } from '../../../fcframe/fcframe';

import { FCConstant } from '../../FCConstant/FCConstant';
import FCLoadManager from '../../load/FCLoadManager';
import { FCConfigCtrl } from './FCConfigCtrl';


const { ccclass, property } = _decorator;

@ccclass("FCAudioMgr")
export class FCAudioMgr extends Component {

    private static _instance: FCAudioMgr = null

    public static get Instance(): FCAudioMgr {

        if (this._instance == null) {
            this._instance = new FCAudioMgr()
        }
        return this._instance
    }
    public static set Instance(_instance: FCAudioMgr) {
        this._instance = _instance
    }
    public playLongEffect(path: string) {
        fcframe.audio.playLongEffect("res/load/sound/" + path, "resources")
    }
    public stopLongEffect(url: string) {
        fcframe.audio.stopEffectLong("res/load/sound/" + url)
    }
    public isMusicPlaying() {
        return fcframe.audio.isMusicPlaying()
    }

    public playMusic(path: string = null) {
        if (!path) {
            // let list = ["BGM1", "BGM2"];
            // path = list[Math.floor(Math.random() * list.length)];
            path = "bgm"
        }
        fcframe.audio.playMusic("res/load/sound/" + path, "resources")
    }

    public stopMusic() {
        fcframe.audio.stopMusic()
    }

    public playSound(path: string) {
    
        fcframe.audio.playEffect("res/load/sound/" + path, "resources")
    }

    public stopAll() {
        fcframe.audio.stopAll()
    }
    public removeAudioRootNode() {
        fcframe.audio && fcframe.audio.removeAudioRootNode()
    }

    public resumeMusic(){
        fcframe.audio.resumeMusic();
    }

}

