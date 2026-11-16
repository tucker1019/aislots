
import { Component, game, isValid, Node } from "cc";
import { FTConstant } from "../../game/FTConstant/FTConstant";
import { FTGlobal } from "../../game/view/layer/FTGlobal";
import { ftframe } from "../ftframe";

import { FTAudioEffect } from "./FTAudioEffect";
import { FTAudioMusic } from "./FTAudioMusic";
import { FTAudioEffectLong } from "./FTAudioMusicLong";

const LOCAL_STORE_KEY = "game_audio";

export class FTAudioManager extends Component {
    private static _instance: FTAudioManager;
    private static audio: Node = null;
   
    public static set instance(_instance: FTAudioManager) {
        this._instance = _instance
    }
    public static get instance(): FTAudioManager {
        if (this._instance == null) {

            this.audio = new Node("UIAudioManager");
            game.addPersistRootNode(this.audio);

            this._instance = this.audio.addComponent(FTAudioManager);
            var music = new Node("UIMusic");
            music.parent = this.audio;
            this._instance.music = music.addComponent(FTAudioMusic);

            var effect = new Node("UIEffect");
            effect.parent = this.audio;
            
            this._instance.effect = effect.addComponent(FTAudioEffect);


            this._instance.init();

        }
        return this._instance;
    }
    private local_data: any = {};

    private music!: FTAudioMusic;
    private effect!: FTAudioEffect;

    private effectLong: FTAudioEffectLong[] = [];

    private _volume_music: number = 1;
    private _volume_effect: number = 1;
    private _switch_music: boolean = true;
    private _switch_effect: boolean = true;
    private _uuid: string = "10000";                // 玩家唯一标识，一般为玩家数据库唯一编号
    private _localStorageTag: string = `${LOCAL_STORE_KEY}_${FTGlobal.USER.uid}_${FTConstant.GAMEID}`;          // 本地存储标签名

    // 移除常驻节点
    removeAudioRootNode() {
        if (FTAudioManager.audio) {
            FTAudioManager.instance.stopEffectLong("res/load/sound/games/rolling");
            FTAudioManager.instance.stopEffectLong("res/load/sound/games/bgm_bigwin_end");
            FTAudioManager.instance.stopEffectLong("res/load/sound/games/NICE");
            FTAudioManager.instance.stopEffectLong("res/load/sound/games/YEAH");
            
            game.removePersistRootNode(FTAudioManager.audio)
        }
    }


    private init() {
        let data = ftframe.storage.get(this._localStorageTag, JSON.stringify({
            volume_music: 1,
            volume_effect: 1,
            switch_music: true,
            _switch_effect: true,
        }));
        if (data) {
            try {
                this.local_data = JSON.parse(data);
                this._volume_music = this.local_data.volume_music;
                this._volume_effect = this.local_data.volume_effect;
                this._switch_music = this.local_data.switch_music;
                this._switch_effect = this.local_data.switch_effect;
            }
            catch (e) {
                this.local_data = {};
                this._volume_music = 1;
                this._volume_effect = 1;
                this._switch_music = true;
                this._switch_effect = true;
            }

            this.music.volume = this._volume_music;
            this.effect.volume = this._volume_effect;
        }
    }

    /** 设置玩家唯一标识 */
    public setUuidAndGameId(uid: string, gameId: number) {
        this._uuid = uid;
        this._localStorageTag = `${LOCAL_STORE_KEY}_${this._uuid}_${gameId}`;
    }

    isMusicPlaying(){
        return this.music.playing
    }
    /**
     *  播放背景音乐
     * @param url        资源地址
     * @param callback   音乐播放完成事件
     */
    playMusic(url: string, bundleName: string) {
        if (this._switch_music) {
            this.music.load(url, bundleName);
        }
    }

    rePlayMusic() {
        // this.music.play()
    }

    /**
     * 播放音效
     * @param url        资源地址
     */
    playEffect(url: string, bundleName: string, callbreak?: Function) {
        if (this._switch_effect) {
            this.effect.get(url, bundleName);
        }
    }
    playLongEffect(url, bundleName) {
        if (this._switch_effect) {
            let key: string = "UIEffectLong" + url;
            if (this.effectLong && this.effectLong[key]) return

            var effectlong = new Node(key)
            effectlong.parent = FTAudioManager.audio;

            this.effectLong[key] = effectlong.addComponent(FTAudioEffectLong);
            this.effectLong[key].get(url, bundleName);
        }
    }

    /** 背景音乐音量 */
    public get musicVolume(): number {
        return this._volume_music;
    }
    public set musicVolume(value: number) {
        this._volume_music = value;
        this.music.volume = value;
    }

    /** 音效音量 */
    public get effectVolume(): number {
        return this._volume_effect;
    }
    public set effectVolume(value: number) {
        this._volume_effect = value;
        this.effect.volume = value;
    }

    /** 音乐开关 */
    public getSwitchMusic(): boolean {
        return this._switch_music;
    }
    public setSwitchMusic(value: boolean) {
        this._switch_music = value;
        if (value == false){
            this.music.stop();
        }
          
        else this.music.play();
        this.save()
    }

    /** 音效开关 */
    public getSwitchEffect(): boolean {
        return this._switch_effect;
    }
    public setSwitchEffect(value: boolean) {
        this._switch_effect = value;
        if (value == false)
            this.effect.stop();
        this.save()
    }

    public resumeAll() {
        if (this.music) {
            this.music.play();
            this.effect.play();
        }
    }
    public resumeMusic() {
        if (this.music) {
            this.music.play();
        }
    }

    public pauseAll() {
        if (this.music) {
            this.music.pause();
            this.effect.pause();
        }
    }

    public stopMusic() {
        if (this.music) {
            this.music.stop();
        }
    }

    public stopAll() {
        if (this.music) {
            this.music.stop();
        }
        if (this.effect) this.effect.stop()
        if (this.effectLong) {
            this.effectLong.forEach((value) => {
                value && value.stop();
            })
        }
    }
    public stopEffect() {
        this.effect.stop();
    }
    public stopEffectLong(url: string) {
        if (this.effectLong) {
            console.log("stop=>====>url", url)
            let key: string = "UIEffectLong" + url;
            this.effectLong[key] && this.effectLong[key].stop();
            this.effectLong[key] = null
            let node = FTAudioManager.audio.getChildByName(key)
            if (node && isValid(node)) {
                node.destroy();
            }
        }

    }

    public save() {
        this.local_data.volume_music = this._volume_music;
        this.local_data.volume_effect = this._volume_effect;
        this.local_data.switch_music = this._switch_music;
        this.local_data.switch_effect = this._switch_effect;
        let data = JSON.stringify(this.local_data);

        ftframe.storage.set(this._localStorageTag, data);
    }
}