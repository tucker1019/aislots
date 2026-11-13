import { _decorator, Component } from 'cc';
import { showHtmlBet, showHtmlAuto, closeHtmlPanels } from '../../ui/ag3_panels';
import { wbsgame } from '../wbsgame';
const { ccclass } = _decorator;

/** Preserve serialized component UUID and button entry points. */
@ccclass('WBSPopupMenuCtrl')
export class WBSPopupMenuCtrl extends Component {
    showAudoPanel() { showHtmlAuto(); }
    showRulePanel() { wbsgame.gamelayer.openRules(); }
    showBetPanel() { showHtmlBet(); }
    showAllMoneyPanel() {}
    protected onDestroy() { closeHtmlPanels(); }
}
