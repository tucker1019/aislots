import { _decorator, Component, find, Node } from 'cc';
import { xNodeFT } from '../../../xtools/xNodeFT';
import { FTGameLayerCtrl } from './FTGameLayerCtrl';
import { ftframe } from '../../../ftframe/ftframe';
import { showBetHistory } from '../../history/FTBetHistory';
import { FTAudioMgr } from './FTAudioMgr';
const { ccclass, property } = _decorator;

@ccclass('FTMenu')
export class FTMenu extends Component {
    layerCtrl: FTGameLayerCtrl = null;
    private historyButton: HTMLButtonElement;

    start() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FTGameLayerCtrl);

        xNodeFT.addClick("panel/btn_music", this.node, this.onMusicBtnClick.bind(this))
        xNodeFT.addClick("panel/btn_sound", this.node, this.onSoundBtnClick.bind(this))
        xNodeFT.addClick("panel/btn_rule", this.node, this.onRuleBtnClick.bind(this))
        xNodeFT.addClick("btn_close", this.node, this.onCloseBtnClick.bind(this))

        this.initSoundBtn();
        if (!this.layerCtrl.isReplay) {
            const button = this.historyButton = document.createElement('button');
            button.type = 'button';
            button.textContent = '投注记录';
            button.style.cssText = 'position:fixed;z-index:1000;top:100px;left:50%;transform:translateX(-50%);border:1px solid #bb7c4b;border-radius:16px;background:#30303e;color:#e4c29d;padding:5px 12px;cursor:pointer;';
            button.onclick = () => { this.onClose(); showBetHistory(); };
            document.body.append(button);
        }
    }

    initSoundBtn() {
        xNodeFT.find("panel/btn_music/ic_soundon", this.node).active = ftframe.audio.getSwitchMusic();
        xNodeFT.find("panel/btn_music/ic_soundoff", this.node).active = !ftframe.audio.getSwitchMusic();

        xNodeFT.find("panel/btn_sound/ic_soundon", this.node).active = ftframe.audio.getSwitchEffect();
        xNodeFT.find("panel/btn_sound/ic_soundoff", this.node).active = !ftframe.audio.getSwitchEffect();
    }

    onMusicBtnClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");

        let ic_soundon = xNodeFT.find("panel/btn_music/ic_soundon", this.node);
        let ic_soundoff = xNodeFT.find("panel/btn_music/ic_soundoff", this.node);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        ftframe.audio.setSwitchMusic(ic_soundon.active);
    }

    onSoundBtnClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");

        let ic_soundon = xNodeFT.find("panel/btn_sound/ic_soundon", this.node);
        let ic_soundoff = xNodeFT.find("panel/btn_sound/ic_soundoff", this.node);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        ftframe.audio.setSwitchEffect(ic_soundon.active);
    }

    onRuleBtnClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        this.onClose();
        this.layerCtrl.popupMenuCtrl.showRulePanel();
    }

    onCloseBtnClick(){
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        this.onClose();
    }

    onDestroy() { this.historyButton?.remove(); }

    onClose(){
        this.node.destroy();
    }

}


