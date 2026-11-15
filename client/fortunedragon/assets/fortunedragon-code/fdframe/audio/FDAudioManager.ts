
import { Component, game, isValid, Node } from "cc";
import { FDConstant } from "../../game/FDConstant/FDConstant";
import { FDGlobal } from "../../game/view/layer/FDGlobal";
import { fdframe } from "../fdframe";

import { FDAudioEffect } from "./FDAudioEffect";
import { FDAudioMusic } from "./FDAudioMusic";
import { FDAudioEffectLong } from "./FDAudioMusicLong";

const LOCAL_STORE_KEY = "game_audio";

export class FDAudioManager extends Component {
    private static _instance: FDAudioManager;
    private static audio: Node = null;

    public static set instance(_instance: FDAudioManager) {
        this._instance = _instance
    }
    public static get instance(): FDAudioManager {
        if (this._instance == null) {

            this.audio = new Node("UIAudioManager");
            game.addPersistRootNode(this.audio);

            this._instance = this.audio.addComponent(FDAudioManager);
            var music = new Node("UIMusic");
            music.parent = this.audio;
            this._instance.music = music.addComponent(FDAudioMusic);

            var effect = new Node("UIEffect");
            effect.parent = this.audio;

            this._instance.effect = effect.addComponent(FDAudioEffect);


            this._instance.init();

        }
        return this._instance;
    }
    private local_data: any = {};

    private music!: FDAudioMusic;
    private effect!: FDAudioEffect;

    private effectLong: FDAudioEffectLong[] = [];

    private _volume_music: number = 1;
    private _volume_effect: number = 1;
    private _switch_music: boolean = true;
    private _switch_effect: boolean = true;
    private _uuid: string = "10000";                // 玩家唯一标识，一般为玩家数据库唯一编号
    private _localStorageTag: string = `${LOCAL_STORE_KEY}_${FDGlobal.USER.uid}_${FDConstant.GAMEID}`;          // 本地存储标签名

    // 移除常驻节点
    removeAudioRootNode() {
        if (FDAudioManager.audio) {
            FDAudioManager.instance.stopEffectLong("res/sound/games/bgm_bigwin_end");


            game.removePersistRootNode(FDAudioManager.audio)
        }
    }


    private init() {
        let data = fdframe.storage.get(this._localStorageTag, JSON.stringify({
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

    isMusicPlaying() {
        return this.music.playing
    }
    /**
     *  播放背景音乐
     * @param url        资源地址
     * @param callback   音乐播放完成事件
     */
    playMusic(url: string, bundleName: string, bloop = true) {
        if (this._switch_music) {
            this.music.load(url, bundleName, bloop);
        }
    }

    rePlayMusic() {
        // this.music.play()
    }


    setMusicComplete(func: Function) {
        this.music.onComplete = func;
    }

    /**
     * 播放音效
     * @param url        资源地址
     */
    playEffect(url: string, bundleName: string, callbreak?: Function) {
        if (this._switch_effect) {
            this.effect.load(url, bundleName);
        }
    }
    playLongEffect(url, bundleName) {
        if (this._switch_effect) {
            let key: string = "UIEffectLong" + url;
            if (this.effectLong && this.effectLong[key]) return

            var effectlong = new Node(key)
            effectlong.parent = FDAudioManager.audio;

            this.effectLong[key] = effectlong.addComponent(FDAudioEffectLong);
            this.effectLong[key].load(url, bundleName);
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
        if (value == false) {
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
            let node = FDAudioManager.audio.getChildByName(key)
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

        fdframe.storage.set(this._localStorageTag, data);
    }
}