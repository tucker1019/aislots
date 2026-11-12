import { _decorator, AudioClip, AudioSource, Component, isValid, Node, path } from 'cc';
import { wbsgame } from '../wbsgame';
import { consoleLogError } from '../../xtools/WBSUtils';
import { WBSConstant } from '../constant/WBSConstant';
const { ccclass } = _decorator;

@ccclass('WBSAudioManager')
export class WBSAudioManager extends Component {


    private _music: AudioSource = null;
    private _sound: AudioSource = null;
    private _longSound: AudioSource[] = [];//播放可以手动停止的音效

    protected onLoad(): void {
        this._music = new Node("Music").addComponent(AudioSource)
        this._sound = new Node("Sound").addComponent(AudioSource)
        this._music.node.parent = this.node
        this._sound.node.parent = this.node
    }

    isMusicPlaying() {
        return this._music.playing;
    }

    getMusicPlayingName() {
        return this._music.playing ? this._music.clip.name : "";
    }

    stopMusic() {
        this._music.stop()
    }

    playMusic(uri: string, callback?) {
        if (!wbsgame.gameMgr.getUserData().musicSwitch) return
        uri = path.join(WBSConstant.SOUND_PARH, uri)
        wbsgame.loadMgr.loadAudio(uri, (err: Error, data: AudioClip) => {
            if (err) return
            if (!isValid(this.node)) return//防止音乐还没加载完 场景就被销毁了
            callback && callback()
            this._music.enabled = true;
            this._music.stop();
            this._music.clip = data;
            this._music.loop = true;
            this._music.play();
        })
    }

    playSound(uri: string) {
        if (!wbsgame.gameMgr.getUserData().soundSwitch) return
        uri = path.join(WBSConstant.SOUND_PARH, uri)
        wbsgame.loadMgr.loadAudio(uri, (err: Error, data: AudioClip) => {
            if (err) return
            if (!isValid(this.node)) return//防止音乐还没加载完 场景就被销毁了
            this._sound.playOneShot(data);
        })
    }

    playLongSound(uri: string) {
        if (!wbsgame.gameMgr.getUserData().soundSwitch) return
        uri = path.join(WBSConstant.SOUND_PARH, uri)
        if (this._longSound[uri]) {
            this._longSound[uri].enabled = true;
            this._longSound[uri].stop();
            this._longSound[uri].loop = true;
            this._longSound[uri].play();
            return
        }
        wbsgame.loadMgr.loadAudio(uri, (err: Error, data: AudioClip) => {
            if (err) {
                consoleLogError(err)
                return
            }
            if (!isValid(this.node)) return//防止音乐还没加载完 场景就被销毁了
            this._longSound[uri] = new Node("LongMusic" + uri).addComponent(AudioSource)
            this._longSound[uri].node.parent = this.node
            this._longSound[uri].enabled = true;
            this._longSound[uri].stop();
            this._longSound[uri].clip = data;
            this._longSound[uri].loop = true;
            this._longSound[uri].play();

        })
    }

    stopLongSound(uri: string) {
        uri = path.join(WBSConstant.SOUND_PARH, uri)
        if (this._longSound[uri]) this._longSound[uri].stop();
    }

    stopAllSound() {
        if (this._sound) this._sound.stop();
        if (this._music) this._music.stop();
        for (let i = 0; i < this._longSound.length; i++) {
            this._longSound[i].stop();
        }
    }

}

