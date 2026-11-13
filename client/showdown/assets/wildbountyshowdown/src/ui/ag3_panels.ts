import { AutoSpinPage } from './auto_spin_page';
import { BetOptionsPage } from './bet_options_page';
import { buildChoices } from './bet_choices';
import { formatMinor } from '../network/display';
import { wbsgame } from '../wbsgame/wbsgame';
import { WBSSTATE, WBSConstant } from '../wbsgame/constant/WBSConstant';
let betPage: BetOptionsPage | null = null, autoPage: AutoSpinPage | null = null;
function allowed() {
    return !wbsgame.sendMgr.readOnly && wbsgame.gamelayer.isGameEnd && wbsgame.gameMgr.getState() === WBSSTATE.READY && !wbsgame.gameMgr.getIsAuto();
}
const sound = () => wbsgame.audioMgr.playSound('list_item_click');
export function closeHtmlPanels() { betPage?.destroy(); autoPage?.destroy(); betPage = null; autoPage = null; }
export function showHtmlBet() {
    if (!allowed()) return;
    const canvas = document.getElementById('GameCanvas'); if (!(canvas instanceof HTMLCanvasElement)) return;
    closeHtmlPanels();
    betPage = new BetOptionsPage(canvas, () => {
        const mgr = wbsgame.gameMgr;
        return {choices: buildChoices(mgr.getMultiples().map(String), WBSConstant.ALL_LINE, mgr.betLevelLimit), bet: String(mgr.getBitNum()), level: mgr.getBitMultIndex()+1, lines: WBSConstant.ALL_LINE, balance: String(mgr.getUserData().coin)};
    }, (bet,level) => {
        if (!allowed()) return;
        const mgr = wbsgame.gameMgr, index = mgr.getMultiples().indexOf(Number(bet));
        if (index < 0 || level < 1 || level > mgr.betLevelLimit) return;
        mgr.setBitIndex(index); mgr.setBitMultIndex(level-1);
        wbsgame.gamelayer.optCtrl.updateBitView(mgr.getTotalBitIndexBy(index,level-1));
    }, sound);
    betPage.open();
}
export function showHtmlAuto() {
    if (!allowed()) return;
    const canvas = document.getElementById('GameCanvas'); if (!(canvas instanceof HTMLCanvasElement)) return;
    closeHtmlPanels();
    autoPage = new AutoSpinPage(canvas, count => {
        if (allowed()) wbsgame.gamelayer.optCtrl.onAutoSelectClick(count);
    }, () => ({balance: formatMinor(wbsgame.gameMgr.getUserData().coin), bet: formatMinor(wbsgame.gameMgr.getTotalBitNum())}), sound);
    autoPage.open();
}
