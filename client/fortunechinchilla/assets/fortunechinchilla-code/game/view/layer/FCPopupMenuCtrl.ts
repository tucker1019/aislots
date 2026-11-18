import { _decorator, find } from 'cc';
import { FCBaseNode } from '../../base/FCBaseNode';
import { FCGameLayerCtrl } from './FCGameLayerCtrl';
import { showMoney } from '../../common/FCUtils';
import { alertGame } from '../../net/FCGameUI';
@_decorator.ccclass('FCPopupMenuCtrl')
export class FCPopupMenuCtrl extends FCBaseNode {
    protected initAttribute() {}
    showAllMoneyPanel() {
        const game = find('Canvas/GameLayer').getComponent(FCGameLayerCtrl);
        alertGame('Saldo: ' + (game.isReplay ? '******' : showMoney(game.optCtrl.curAllMoney)));
    }
}
