import { _decorator, Component, find, Node } from 'cc';
import { xNodeFL } from '../../../xtools/xNodeFL';
import { FLGameLayerCtrl } from './FLGameLayerCtrl';
import { flframe } from '../../../flframe/flframe';
import { FLAudioMgr } from './FLAudioMgr';
const { ccclass, property } = _decorator;

@ccclass('FLMenu')
export class FLMenu extends Component {
    layerCtrl: FLGameLayerCtrl = null;

    start() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FLGameLayerCtrl);

        xNodeFL.addClick("panel/btn_music", this.node, this.onMusicBtnClick.bind(this))
        // xNodeFL.addClick("panel/btn_sound", this.node, this.onSoundBtnClick.bind(this))
        xNodeFL.addClick("panel/btn_rule", this.node, this.onRuleBtnClick.bind(this))
        xNodeFL.addClick("btn_close", this.node, this.onCloseBtnClick.bind(this))

        this.initSoundBtn();
    }

    initSoundBtn() {
        xNodeFL.find("panel/btn_music/ic_soundon", this.node).active = flframe.audio.getSwitchMusic();
        xNodeFL.find("panel/btn_music/ic_soundoff", this.node).active = !flframe.audio.getSwitchMusic();

        // xNodeFL.find("panel/btn_sound/ic_soundon", this.node).active = flframe.audio.getSwitchEffect();
        // xNodeFL.find("panel/btn_sound/ic_soundoff", this.node).active = !flframe.audio.getSwitchEffect();
    }

    onMusicBtnClick() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");

        let ic_soundon = xNodeFL.find("panel/btn_music/ic_soundon", this.node);
        let ic_soundoff = xNodeFL.find("panel/btn_music/ic_soundoff", this.node);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        flframe.audio.setSwitchMusic(ic_soundon.active);
        flframe.audio.setSwitchEffect(ic_soundon.active);
    }

    // onSoundBtnClick() {
    //     FLAudioMgr.Instance.playSound("games/menu_icon_press");

    //     let ic_soundon = xNodeFL.find("panel/btn_sound/ic_soundon", this.node);
    //     let ic_soundoff = xNodeFL.find("panel/btn_sound/ic_soundoff", this.node);
    //     ic_soundon.active = !ic_soundon.active;
    //     ic_soundoff.active = !ic_soundoff.active;

    //     flframe.audio.setSwitchEffect(ic_soundon.active);
    // }

    onRuleBtnClick() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        this.onClose();
        this.layerCtrl.popupMenuCtrl.showRulePanel();
    }

    onCloseBtnClick(){
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        this.onClose();
    }

    onClose(){
        this.node.destroy();
    }

}


