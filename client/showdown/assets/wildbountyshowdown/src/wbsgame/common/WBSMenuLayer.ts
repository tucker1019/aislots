import { _decorator, Component, find, instantiate, Node, tween, UITransform, Vec3, Widget } from 'cc';
import { xNodeWBS } from '../../../src/xtools/xNodeWBS';
import { WBSGameLayer } from '../view/WBSGameLayer';
import { wbsgame } from '../wbsgame';
const { ccclass, property } = _decorator;

@ccclass('WBSMenu')
export class WBSMenu extends Component {
    layerCtrl: WBSGameLayer = null;
    aniIng: boolean = false


    start() {
        this.layerCtrl = find("Canvas").getChildByName("gamelayer").getComponent(WBSGameLayer);

        xNodeWBS.addClick("panel/btn_music", this.node, this.onMusicBtnClick.bind(this))
        xNodeWBS.addClick("panel/btn_sound", this.node, this.onSoundBtnClick.bind(this))
        xNodeWBS.addClick("panel/btn_rule", this.node, this.onRuleBtnClick.bind(this))
        xNodeWBS.addClick("btn_close", this.node, this.onCloseBtnClick.bind(this))

        let aniNode = this.node.getChildByName("panel")
        aniNode.getComponent(Widget).updateAlignment();
        this.aniIng = true
        tween(aniNode).by(.2, { position: new Vec3(0, - aniNode.getComponent(UITransform).height, 0) }).call(() => { this.aniIng = false }).start()

        this.initSoundBtn();
    }

    initSoundBtn() {
 
        xNodeWBS.find("panel/btn_sound/ic_soundon", this.node).active = wbsgame.gameMgr.getUserData().soundSwitch;
        xNodeWBS.find("panel/btn_sound/ic_soundoff", this.node).active = !wbsgame.gameMgr.getUserData().soundSwitch;
    }

    onMusicBtnClick() {
        wbsgame.audioMgr.playSound("menu_icon_press");

        let ic_soundon = xNodeWBS.find("panel/btn_music/ic_soundon", this.node);
        let ic_soundoff = xNodeWBS.find("panel/btn_music/ic_soundoff", this.node);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        wbsgame.gameMgr.setUserData({ musicSwitch: ic_soundon.active });
        if (wbsgame.gameMgr.getUserData().musicSwitch) wbsgame.audioMgr.playMusic("bgm_mg")
        else wbsgame.audioMgr.stopMusic()
    }

    onSoundBtnClick() {
        wbsgame.audioMgr.playSound("menu_icon_press");

        let ic_soundon = xNodeWBS.find("panel/btn_sound/ic_soundon", this.node);
        let ic_soundoff = xNodeWBS.find("panel/btn_sound/ic_soundoff", this.node);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        wbsgame.gameMgr.setUserData({ soundSwitch: ic_soundon.active });
        if (!wbsgame.gameMgr.getUserData().soundSwitch) {
            wbsgame.audioMgr.stopAllSound()
            wbsgame.audioMgr.stopMusic()
        }else{
            wbsgame.audioMgr.playMusic("bgm_mg")
        }
       
    }

    onRuleBtnClick() {
        wbsgame.audioMgr.playSound("menu_icon_press");
        this.onClose();
        this.layerCtrl.popupMenuCtrl.showRulePanel();
        // let layer = find("Canvas/TopLayer/WBSRuleLayer",)
        // if (layer) {
        //     layer.destroy();
        // } else{
        //     layer = instantiate(wbsgame.gamelayer.panelRulePrefab);
        //     layer.name = "WBSRuleLayer";
        //     layer.parent =  find("Canvas/TopLayer")
        //     layer.active = true;
        // }
    }

    onCloseBtnClick() {
        wbsgame.audioMgr.playSound("menu_icon_press");
        this.onClose();
    }

    onClose() {
        let aniNode = this.node.getChildByName("panel")
        this.aniIng = true
        tween(aniNode).by(.2, { position: new Vec3(0, aniNode.getComponent(UITransform).height, 0) }).call(() => { this.aniIng = false; this.node.destroy(); }).start()

    }

}


