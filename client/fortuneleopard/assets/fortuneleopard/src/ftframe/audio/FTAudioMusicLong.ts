
import { AudioClip, AudioSource, error, _decorator } from 'cc';
import { ftframe } from '../ftframe';


const { ccclass, menu } = _decorator;

/** 长音效 */
@ccclass('FTAudioEffectLong')
export class FTAudioEffectLong extends AudioSource {
    /** 背景音乐播放完成回调 */
    onComplete: Function | null = null;

    private _progress: number = 0;
    private _url: string = null!;
    private _isPlay: boolean = false;


    /** 获取音乐播放进度 */
    get progress(): number {
        if (this.duration > 0)
            this._progress = this.currentTime / this.duration;
        return this._progress;
    }
    /**
     * 设置音乐当前播放进度
     * @param value     进度百分比0到1之间
     */
    set progress(value: number) {
        this._progress = value;
        this.currentTime = value * this.duration;
    }


    get(url: string, bundleName: string) {
        try {
            let data = ftframe.res.get(url, AudioClip, bundleName)
            if (this.playing) {
                this._isPlay = false;
                this.stop();
            }
            this.enabled = true;
            this.clip = data;
            // 注：事件定义在这里，是为了在播放前设置初始播放位置数据
            // callback && callback();
            this.play();
            this._url = url;
        } catch (error) {

        }
    }

    /**
     * 加载音乐并播放
     * @param url          音乐资源地址
     * @param callback     加载完成回调
     */
    public load(url: string, bundleName: string) {
        if (this.playing) return;
        try {
            ftframe.res.load(bundleName, url, AudioClip, (err: Error | null, data: AudioClip) => {
                if (err) {
                    error(err);
                    return
                }
                if (this.playing) {
                    this._isPlay = false;
                    this.stop();
                    ftframe.res.release(this._url);
                }
                this.enabled = true;
                this.clip = data;
                // 注：事件定义在这里，是为了在播放前设置初始播放位置数据
                // callback && callback();
                this.play();
                this._url = url;
            });
        } catch (error) {

        }

    }


    /** cc.Component 生命周期方法，验证背景音乐播放完成逻辑，建议不要主动调用 */
    update(dt: number) {
        if (this.currentTime > 0) {
            this._isPlay = true;
        }

        if (this._isPlay && this.playing == false) {
            this._isPlay = false;
            this.enabled = false
            this.onComplete && this.onComplete();
        }
    }

    /** 释放当前背景音乐资源 */
    release() {
        if (this._url) {
            ftframe.res.release(this._url);
            this._url = null!;
        }
    }
}
