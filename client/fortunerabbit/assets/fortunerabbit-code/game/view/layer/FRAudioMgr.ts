import { _decorator, Component, Node, game, Game, AudioSource, AudioClip } from 'cc';
import { frframe } from '../../../frframe/frframe';

import FRLoadManager from '../../load/FRLoadManager';
import { FRConfigCtrl } from './FRConfigCtrl';


const { ccclass, property } = _decorator;

@ccclass("FRAudioMgr")
export class FRAudioMgr extends Component {

    private static _instance: FRAudioMgr = null

    public static get Instance(): FRAudioMgr {

        if (this._instance == null) {
            this._instance = new FRAudioMgr()
        }
        return this._instance
    }
    public static set Instance(_instance: FRAudioMgr) {
        this._instance = _instance
    }
    public playLongEffect(path: string) {
        frframe.audio.playLongEffect("res/load/sound/" + path, "resources")
    }
    public stopLongEffect(url: string) {
        frframe.audio.stopEffectLong("res/load/sound/" + url)
    }
    public isMusicPlaying() {
        return frframe.audio.isMusicPlaying()
    }

    public playMusic(path: string = null) {
        if (!path) {
            // let list = ["BGM1", "BGM2"];
            // path = list[Math.floor(Math.random() * list.length)];
            path = "bgm"
        }
        frframe.audio.playMusic("res/load/sound/" + path, "resources")
    }

    public stopMusic() {
        frframe.audio.stopMusic()
    }

    public playSound(path: string) {
    
        frframe.audio.playEffect("res/load/sound/" + path, "resources")
    }

    public stopAll() {
        frframe.audio.stopAll()
    }
    public removeAudioRootNode() {
        frframe.audio && frframe.audio.removeAudioRootNode()
    }

    public resumeMusic(){
        frframe.audio.resumeMusic();
    }

}

