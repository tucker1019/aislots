/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-01-12 17:12:14
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-01-12 18:22:15
 * @FilePath: /1048FortuneDragon/assets/fortunedragon/src/game/view/layer/FDAudioMgr.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { _decorator, Component, Node, game, Game, AudioSource, AudioClip } from 'cc';
import { fdframe } from '../../../fdframe/fdframe';

import { FDConstant } from '../../FDConstant/FDConstant';
import FDLoadManager from '../../load/FDLoadManager';
import { FDConfigCtrl } from './FDConfigCtrl';


const { ccclass, property } = _decorator;

@ccclass("FDAudioMgr")
export class FDAudioMgr extends Component {

    private static _instance: FDAudioMgr = null

    public static get Instance(): FDAudioMgr {

        if (this._instance == null) {
            this._instance = new FDAudioMgr()
        }
        return this._instance
    }
    public static set Instance(_instance: FDAudioMgr) {
        this._instance = _instance
    }
    public playLongEffect(path: string) {
        fdframe.audio.playLongEffect("res/sound/" + path, FDConstant.BUNDLENAME)
    }
    public stopLongEffect(url: string) {
        fdframe.audio.stopEffectLong("res/sound/" + url)
    }
    public isMusicPlaying() {
        return fdframe.audio.isMusicPlaying()
    }

    public setMusicComplete(func: Function) {
        fdframe.audio.setMusicComplete(func)
    }

    public playMusic(path: string = null, bloop = true) {
        if (!path) {
            // let list = ["BGM1", "BGM2"];
            // path = list[Math.floor(Math.random() * list.length)];
            path = "bgm_mg_loop"
        }
        fdframe.audio.playMusic("res/sound/" + path, FDConstant.BUNDLENAME, bloop)
    }

    public stopMusic() {
        fdframe.audio.stopMusic()
    }

    public playSound(path: string) {

        fdframe.audio.playEffect("res/sound/" + path, FDConstant.BUNDLENAME)
    }

    public stopAll() {
        fdframe.audio.stopAll()
    }
    public removeAudioRootNode() {
        fdframe.audio && fdframe.audio.removeAudioRootNode()
    }

    public resumeMusic() {
        fdframe.audio.resumeMusic();
    }

}

