
import { AudioClip, AudioSource, error, _decorator } from 'cc';
import { ftframe } from '../ftframe';


const { ccclass } = _decorator;

/**
 * 注：用playOneShot播放的音乐效果，在播放期间暂时没办法即时关闭音乐
 */

/** 游戏音效 */
@ccclass('FTAudioEffect')
export class FTAudioEffect extends AudioSource {
    private effects: Map<string, AudioClip> = new Map<string, AudioClip>();

    /**
     * 加载音效并播放
     * @param url           音效资源地址
     * @param callback      资源加载完成并开始播放回调
     */
    load(url: string, bundleName: string, callbreak?: Function) {
        ftframe.res.load(bundleName, url, AudioClip, (err: Error | null, data: AudioClip) => {
            if (err) {
                error(err);
            }
            callbreak && callbreak()
            this.effects.set(url, data);
            this.playOneShot(data, this.volume);
        });
    }
    stopByUrl(url) {
        let data = this.effects.get(url);
                
    }

    public get(url: string, bundleName: string) {
        let audio: AudioClip = ftframe.res.get(url, AudioClip, bundleName)
        this.effects.set(url, audio);
        this.playOneShot(audio, this.volume);
    }

    /** 释放所有已使用过的音效资源 */
    release() {
        for (let key in this.effects) {
            ftframe.res.release(key);
        }
        this.effects.clear();
    }
}
