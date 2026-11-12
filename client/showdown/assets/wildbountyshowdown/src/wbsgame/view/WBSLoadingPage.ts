import { _decorator, Animation, Component, isValid, Node, PageView, ParticleSystem2D } from 'cc';
import { xNodeWBS } from '../../xtools/xNodeWBS';
const { ccclass, property } = _decorator;

@ccclass('WBSLoadingPage')
export class WBSLoadingPage extends Component {


    start() {

    }

    showContinueBtn(bShow: boolean, continueFunc?: Function) {
        let continueBtn = xNodeWBS.find("continueBtn", this.node);
        continueBtn.active = bShow;
        xNodeWBS.setActive("retaLab", this.node, !bShow);
        xNodeWBS.setActive("ProgressBar", this.node, !bShow);
        if (bShow) {

            if (continueFunc) {
                continueBtn.off("click");
                continueBtn.on("click", (() => {
                    continueFunc();
                }));
            }
        }
    }
}


