import { _decorator, Component, instantiate, Label, Node, PageView, ScrollView, UITransform, Vec2, Vec3 } from 'cc';
import { xNodeFT } from '../../../xtools/xNodeFT';
import { FTGameManager } from '../../mgr/FTGameManager';
import { FTConstant } from '../../FTConstant/FTConstant';
import { showMoney } from '../../common/FTUtils';
import { FTPopupMenuCtrl } from './FTPopupMenuCtrl';
import { FTAudioMgr } from './FTAudioMgr';
const { ccclass, property } = _decorator;

@ccclass('FTBetOptionCtrl')
export class FTBetOptionCtrl extends Component {

    popupMenuCtrl: FTPopupMenuCtrl;

    scrollView_bet: ScrollView;
    scrollView_mult: ScrollView;
    scrollView_tot: ScrollView;

    betItem0: Node;
    multItem0: Node;
    totItem0: Node;

    betItemHeight: number = 0;
    multItemHeight: number = 0;
    totItemHeight: number = 0;

    betIndexLast: number = -1;
    multIndexLast: number = -1;
    totIndexLast: number = -1;
    betIndex: number = -1;
    multIndex: number = -1;
    totIndex: number = -1;

    protected onLoad(): void {
        this.scrollView_bet = xNodeFT.findComponent("auto_panel2/mask/ScrollView1", this.node, ScrollView);
        this.scrollView_mult = xNodeFT.findComponent("auto_panel2/mask/ScrollView2", this.node, ScrollView);
        this.scrollView_tot = xNodeFT.findComponent("auto_panel2/mask/ScrollView3", this.node, ScrollView);
    }

    protected start(): void {
        this.betItem0 = this.scrollView_bet.content.children[0];
        this.multItem0 = this.scrollView_mult.content.children[0];
        this.totItem0 = this.scrollView_tot.content.children[0];
        this.betItemHeight = this.betItem0.getComponent(UITransform).height;
        this.multItemHeight = this.multItem0.getComponent(UITransform).height;
        this.totItemHeight = this.totItem0.getComponent(UITransform).height;

        this.scrollView_bet.node.on("scroll-ended", this.betScrollEnd, this);
        this.scrollView_mult.node.on("scroll-ended", this.multScrollEnd, this);
        this.scrollView_tot.node.on("scroll-ended", this.totScrollEnd, this);

        let btn_max = this.node.getChildByName("btn_max");
        let btn_confirm = this.node.getChildByName("btn_confirm");
        let ic_close = this.node.getChildByName("ic_close");
        xNodeFT.addClick("", btn_max, this.onClickMax.bind(this));
        xNodeFT.addClick("", btn_confirm, this.onClickConfirm.bind(this));
        xNodeFT.addClick("", ic_close, this.onClickClose.bind(this));
    }

    init(menuCtrl) {
        this.popupMenuCtrl = menuCtrl;

        let betlist = FTGameManager.getMultiples();
        let multList = FTGameManager.getMultIndexs();
        let totalList = FTGameManager.getTotalBitList();

        for (let i = 0; i < betlist.length; i++) {
            let betItem = instantiate(this.betItem0);
            betItem.getComponent(Label).string = showMoney(betlist[i]);
            betItem.name = "item" + (i + 1);
            this.scrollView_bet.content.addChild(betItem);
        }
        let endbetItem = instantiate(this.betItem0);
        endbetItem.name = "item" + (betlist.length + 1);
        this.scrollView_bet.content.addChild(endbetItem);

        for (let i = 0; i < multList.length; i++) {
            let multItem = instantiate(this.multItem0);
            multItem.getComponent(Label).string = multList[i] + "";
            multItem.name = "item" + (i + 1);
            this.scrollView_mult.content.addChild(multItem);
        }
        let endmultItem = instantiate(this.multItem0);
        endmultItem.name = "item" + (multList.length + 1);
        this.scrollView_mult.content.addChild(endmultItem);

        for (let i = 0; i < totalList.length; i++) {
            let totItem = instantiate(this.totItem0);
            totItem.getComponent(Label).string = showMoney(totalList[i]);
            totItem.name = "item" + (i + 1);
            this.scrollView_tot.content.addChild(totItem);

        }
        let endtotItem = instantiate(this.totItem0);
        endtotItem.name = "item" + (totalList.length + 1);
        this.scrollView_tot.content.addChild(endtotItem);

        this.showUI();
    }

    showUI() {
        this.betIndex = FTGameManager.getBitIndex();
        this.multIndex = FTGameManager.getBitMultIndex();
        this.totIndex = FTGameManager.getTotalBitIndex();

        this.scheduleOnce(() => {
            this.updatePanel2();
            this.popupMenuCtrl.updateMoney(xNodeFT.findComponent("node_all/lab", this.node, Label), xNodeFT.findComponent("node_bet/lab", this.node, Label), xNodeFT.findComponent("node_win/lab", this.node, Label));
        }, 0)
    }


    changeBetIndex(index) {
        let betlist = FTGameManager.getMultiples();
        index = Math.max(index, 1);
        index = Math.min(index, betlist.length);

        this.scrollView_bet.scrollToOffset(new Vec2(0, index * this.betItemHeight));
        if (this.betIndex != index - 1) {
            this.betIndex = index - 1;
            this.totIndex = FTGameManager.getTotalBitIndexBy(this.betIndex, this.multIndex);
            this.updatePanel2();
        }
    }
    betScrollEnd() {
        let pos = this.scrollView_bet.getScrollOffset();
        let index = Math.floor(pos.y / this.betItemHeight);
        let rH = pos.y % this.betItemHeight;
        if (rH > this.betItemHeight / 2) {
            index += 1;
        }
        this.changeBetIndex(index);
    }
    clickbetItem(event) {
        FTAudioMgr.Instance.playSound("games/list_item_click");
        let node = event.target;
        let name = node.name;
        let index = Number(name.slice(4));
        this.changeBetIndex(index);
    }

    changeMultIndex(index) {
        let multList = FTGameManager.getMultIndexs();
        index = Math.max(index, 1);
        index = Math.min(index, multList.length);

        this.scrollView_mult.scrollToOffset(new Vec2(0, index * this.multItemHeight));
        if (this.multIndex != index - 1) {
            this.multIndex = index - 1;
            this.totIndex = FTGameManager.getTotalBitIndexBy(this.betIndex, this.multIndex);
            this.updatePanel2();
        }
    }
    multScrollEnd() {
        let pos = this.scrollView_mult.getScrollOffset();
        let index = Math.floor(pos.y / this.multItemHeight);
        let rH = pos.y % this.multItemHeight;
        if (rH > this.multItemHeight / 2) {
            index += 1;
        }
        this.changeMultIndex(index);
    }
    clickmultItem(event) {
        FTAudioMgr.Instance.playSound("games/list_item_click");
        let node = event.target;
        let name = node.name;
        let index = Number(name.slice(4));

        this.changeMultIndex(index);
    }

    changeTotIndex(index) {
        let totalList = FTGameManager.getTotalBitList();
        index = Math.max(index, 1);
        index = Math.min(index, totalList.length);

        this.scrollView_tot.scrollToOffset(new Vec2(0, index * this.totItemHeight));
        if (this.totIndex != index - 1) {
            this.totIndex = index - 1;

            let data = FTGameManager.getBetMultIndexByTotal(this.totIndex);
            this.betIndex = data.bitIndex;
            this.multIndex = data.multIndex;
            this.updatePanel2();
        }
    }
    totScrollEnd() {
        let pos = this.scrollView_tot.getScrollOffset();

        let index = Math.floor(pos.y / this.totItemHeight);
        let rH = pos.y % this.totItemHeight;
        if (rH > this.totItemHeight / 2) {
            index += 1;
        }
        this.changeTotIndex(index);
    }
    clicktotItem(event) {
        FTAudioMgr.Instance.playSound("games/list_item_click");
        let node = event.target;
        let name = node.name;
        let index = Number(name.slice(4));

        this.changeTotIndex(index);
    }


    onClickMax() {
        FTAudioMgr.Instance.playSound("games/list_item_click");
        let totalList = FTGameManager.getTotalBitList();
        let index = totalList.length;

        this.changeTotIndex(index);
    }

    onClickConfirm() {
        FTAudioMgr.Instance.playSound("games/list_item_click");
        FTGameManager.setBitIndex(this.betIndex);
        FTGameManager.setBitMultIndex(this.multIndex);
        FTGameManager.setTotalBitIndex(this.totIndex);
        this.popupMenuCtrl.layerCtrl.optCtrl.updateBitView(FTGameManager.getTotalBitIndex());
        this.onClickClose();
    }

    onClickClose() {
        FTAudioMgr.Instance.playSound("games/list_item_click");
        this.popupMenuCtrl.hidePanel(this.node);
    }

    updatePanel2() {
        if (this.betIndex != this.betIndexLast) {
            this.betIndexLast = this.betIndex;
            this.scrollView_bet.scrollToOffset(new Vec2(0, (this.betIndex + 1) * this.betItemHeight), 0.3);
        }

        if (this.multIndex != this.multIndexLast) {
            this.multIndexLast = this.multIndex;
            this.scrollView_mult.scrollToOffset(new Vec2(0, (this.multIndex + 1) * this.multItemHeight), 0.3);
        }

        if (this.totIndex != this.totIndexLast) {
            this.totIndexLast = this.totIndex;
            this.scrollView_tot.scrollToOffset(new Vec2(0, (this.totIndex + 1) * this.totItemHeight), 0.3);
        }
    }
}

