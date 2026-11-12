import { Ag3History } from '../../history/ag3_history';
import { _decorator, sys, Vec3, tween, find, instantiate, Prefab, Node, UIOpacity, Label, SpriteFrame, Texture2D, sp, Animation, easing } from "cc";
import { xNodeWBS } from "../../xtools/xNodeWBS";
import { WBSPlatformMgr } from "../mgr/WBSPlatformMgr";
import { consoleLog } from "../../xtools/WBSUtils";
import { WBSConstant, WBSSTATE } from "../constant/WBSConstant";
import { WBSConfig } from "../cfg/WBSConfig";
import { WBSBaseLayer } from "../base/WBSBaseLayer";
import { WBSOptLayer } from "./WBSOptLayer";
import { WBSRollLayer } from "./WBSRollLayer";
import { WBSStartPanel } from "./WBSStartPanel";
// import { WBSBoardCtrl } from "./WBSBoardCtrl";
import { wbsgame } from "../wbsgame";
import { WBSEventName } from "../constant/WBSEventName";
import { RollNumLabel } from "../component/RollNumLabel";
import { WBSWinMorePanel } from "./WBSWinMorePanel";
import { WBSLoadManager } from "../mgr/WBSLoadManager";
import { WBSLoadingPage } from "./WBSLoadingPage";
import { WBSPopupMenuCtrl } from "./WBSPopupMenuCtrl";
import { WBSPopupFreeCtrl } from "./WBSPopupFreeCtrl";

const { ccclass, property } = _decorator;

@ccclass('WBSGameLayer')
export class WBSGameLayer extends WBSBaseLayer {

    @property([SpriteFrame])
    CellSprNor: SpriteFrame[] = [];
    @property([SpriteFrame])
    CellSprBlur: SpriteFrame[] = [];
    @property([sp.SkeletonData])
    CellSp: sp.SkeletonData[] = [];

    @property(Prefab)
    CellPrefab: Prefab = null;
    @property(Prefab)
    CellWinPrefab: Prefab = null;
    @property(Prefab)
    antiAnimPrefab: Prefab = null;
    @property(Prefab)
    scaDropAntiPrefab: Prefab = null;
    @property(Prefab)
    addFreeCntAnimPrefab: Prefab = null;
    @property(Prefab)
    loadingPagePrefab: Prefab = null;
    @property(Prefab)
    popupBigWinPrefab: Prefab = null;
    @property(Prefab)
    popupTriFreePrefab: Prefab = null;
    @property(Prefab)
    popupExtraFreePrefab: Prefab = null;
    @property(Prefab)
    popupEndFreePrefab: Prefab = null;
    @property(Prefab)
    panelAutoPrefab: Prefab = null;
    @property(Prefab)
    panelRulePrefab: Prefab = null;
    @property(Prefab)
    panelBalancePrefab: Prefab = null;
    @property(Prefab)
    panelBetPrefab: Prefab = null;
    // @property(Prefab)
    // panelMenuPrefab: Prefab = null;
    @property(Prefab)
    multWinPrefab: Prefab = null;
    @property(Prefab)
    popupPayoutPrefab: Prefab = null;

    private historyPanel: Ag3History;
    private _loaded: boolean = false

    centerRollCtrl: WBSRollLayer = null;
    optCtrl: WBSOptLayer = null;

    myGoldBottom: RollNumLabel = null;
    popupMenuCtrl: WBSPopupMenuCtrl = null;
    freeLayerCtrl: WBSPopupFreeCtrl = null;

    setBtnNode: Node = null;
    // shopBtnNode: Node = null;
    detailBtnNode: Node = null;
    // setExpandBtnNode: Node = null;
    lineNode: Node = null;
    sysAutoNum: number = 0;
    isGameEnd: boolean = true;
    startTime: number = 0;
    firstEnter: boolean = true

    protected onLoad(): void {

        wbsgame.gamelayer = this;
    }

    async start() {
        this.initAttribute();
        this.initBtnClick();
        this.showLoadingPage();
        this._loaded = true;
        const images=new Map<number,string>();
        this.historyPanel=new Ag3History(wbsgame.sendMgr.api,(symbol)=>{
            const id=symbol%1000;if(images.has(id))return images.get(id);
            const sf=this.CellSprNor[id];if(!sf)return '';
            const source=sf.texture instanceof Texture2D ? sf.texture.image?.data : null;
            if(!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof ImageBitmap))return '';
            const rect=sf.rect;const canvas=document.createElement('canvas');canvas.width=rect.width;canvas.height=rect.height;
            const ctx=canvas.getContext('2d');if(!ctx)return '';
            if(sf.rotated){ctx.translate(0,rect.height);ctx.rotate(-Math.PI/2);ctx.drawImage(source,rect.x,rect.y,rect.height,rect.width,0,0,rect.height,rect.width);}
            else ctx.drawImage(source,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);
            const url=canvas.toDataURL();images.set(id,url);return url;
        });
        this.scheduleOnce(() => {
            this.myGoldBottom.setString(wbsgame.gameMgr.getUserData().coin);
            this.optCtrl.setStartBit();
            const state=wbsgame.sendMgr.progress;
            if(wbsgame.sendMgr.readOnly){
                this.optCtrl.updateBtnState(false);
                const params=new URLSearchParams(location.search);
                void wbsgame.sendMgr.retry(()=>this.historyPanel.shared(params.get('replay'),params.get('share')));
                return;
            }
            if(state.lastFrame){
                wbsgame.gameMgr.applyFrame(state.lastFrame);
                this.centerRollCtrl.restoreFrame();
            }
            if(state.hasNext){
                this.isGameEnd=false;
                this.optCtrl.updateBtnState(false);
                wbsgame.loadMgr.showAlert('Continue your unfinished round',()=>this.centerRollCtrl.resumeFrame());
            }
            wbsgame.platformMgr.loadingHide();
            wbsgame.message.dispatchEvent(WBSEventName.SHOW_LOADING,false);
        },0.1);
    }

    initAttribute() {
        this.centerRollCtrl = xNodeWBS.findComponent("roll", this.node, WBSRollLayer);
        this.optCtrl = xNodeWBS.findComponent('bottom', this.node, WBSOptLayer);
        // this.boardCtrl = xNodeWBS.findComponent('roll/board', this.node, WBSBoardCtrl);
        this.popupMenuCtrl = find("Canvas/TopLayer/node_popup_menu").getComponent(WBSPopupMenuCtrl);
        this.freeLayerCtrl = find("Canvas/TopLayer/node_popup_free").getComponent(WBSPopupFreeCtrl);



        this.myGoldBottom = xNodeWBS.findComponent('bottom/panel_parm/node_all/lab', this.node, RollNumLabel);

        this.myGoldBottom.setString(wbsgame.gameMgr.getUserData().coin);
    }

    private initBtnClick() {
        // xNodeWBS.addClick("", this.setExpandBtnNode, this.onClickSetExpandBtn.bind(this));
        // xNodeWBS.addClick("", this.shopBtnNode, this.onClickShopBtn.bind(this));
        xNodeWBS.addClick("", find("Canvas/gamelayer/top/top/btn_exit"), this.onClickExitBtn.bind(this));
        xNodeWBS.addClick("", find("Canvas/gamelayer/top/top/btn_menu"), this.onClickMenuBtn.bind(this));
    }

    // showEnterSceneAni() {
    //     let posOptCtrl: Vec3 = this.optCtrl.node.getPosition();
    //     posOptCtrl.y -= 100;
    //     this.optCtrl.node.setPosition(posOptCtrl);
    //     tween(this.optCtrl.node).by(0.5, { position: new Vec3(0, 100, 0) }).start()
    //     let topNode = xNodeWBS.find("top", this.node);
    //     let posTopNode: Vec3 = topNode.getPosition();
    //     posTopNode.y += 100;
    //     topNode.setPosition(posTopNode);
    //     tween(topNode).by(0.5, { position: new Vec3(0, -100, 0) }).start()
    // }


    onClickExitBtn() {
        wbsgame.audioMgr.playSound("menu_icon_press");
        console.log("onClickExitBtn===>>>>", wbsgame.gameMgr.getState())
        if (WBSSTATE.READY == wbsgame.gameMgr.getState() && this.isGameEnd) {
            wbsgame.sendMgr.sendRequestExitRoom();
            wbsgame.message.dispatchEvent(WBSEventName.SHOW_LOADING, true);
        } else wbsgame.loadMgr.showAlert("The game is not over")

    }

    onClickSetExpandBtn() {
        wbsgame.audioMgr.playSound("menu_icon_press")
        let MenuLayer = find("Canvas/SafeLayer/WBSMenuLayer")
        if (MenuLayer) {
            MenuLayer.destroy();
        } else
            wbsgame.loadMgr.showPrefabWithLoading("res/prefab/WBSMenuLayer", find("Canvas/SafeLayer"))
    }


    showLoadingPage() {
        this.node.getComponent(UIOpacity).opacity = 0;
        let multPanel = xNodeWBS.find("roll/multPanel", this.node)
        multPanel.active = false;

        let mask = xNodeWBS.find("mask", this.node);
        mask.active = true;
        let loadingPage = find("Canvas/TopLayer/loadingPage");
        if (!loadingPage) {
            loadingPage = instantiate(this.loadingPagePrefab);
            loadingPage.parent = find("Canvas/TopLayer");
        }
        loadingPage.active = true;
        let endFunc = () => {
            loadingPage.destroy();

            wbsgame.audioMgr.playSound("bgm_intro");
            this.node.getComponent(UIOpacity).opacity = 255;
            this.node.scale = new Vec3(0.9, 0.9, 1);
            tween(this.node)
                .delay(0.2)
                .to(0.8, { scale: new Vec3(1, 1, 1) }, { easing: "sineIn" })
                .call(() => {
                    let introAnim = xNodeWBS.find("introAnim", this.node);
                    introAnim.active = true;
                    introAnim.getComponent(Animation).play();
                    mask.active = false;
                })
                .delay(4)
                .call(() => {
                    if (!wbsgame.audioMgr.isMusicPlaying())
                        wbsgame.audioMgr.playMusic("bgm_mg");
                }).start();
            this.scheduleOnce(() => {
                multPanel.active = true;
                multPanel.position = new Vec3(0, 1060, 0);
                tween(multPanel).to(0.8, { position: new Vec3(0, 535, 0) })
                    .call(() => {
                        const sweep = xNodeWBS.find("bg_mtp_sweep_add", multPanel);
                        sweep.active = true;
                        sweep.getComponent(Animation).play();
                    }).start();
            }, 1);


        }
        loadingPage.getComponent(WBSLoadingPage).showContinueBtn(true, endFunc);
    }

    // playSrartPanel() {
    //     let node = find("Canvas/TopLayer/startPanel");
    //     if (!node) {
    //         node = instantiate(wbsgame.loadMgr.getPrefab("prefab/layers/startPanel"));
    //         node.parent = find("Canvas/TopLayer");
    //     }
    //     node.active = true;

    //     this.centerRollCtrl.hideNodeList()
    //     // this.optCtrl.node.active = false;

    //     let endFunc = () => {
    //         this.centerRollCtrl.initCellItem()
    //         // this.optCtrl.node.active = true;
    //         this.showWinMorePanel();
    //     }
    //     node.getComponent(WBSStartPanel).setStartFunc(endFunc)
    // }

    // showWinMorePanel() {
    //     let node = find("Canvas/TopLayer/winMorePanel");
    //     if (!node) {
    //         node = instantiate(wbsgame.loadMgr.getPrefab("prefab/layers/winMorePanel"));
    //         node.parent = find("Canvas/TopLayer");
    //     }
    //     node.active = true;
    //     node.getComponent(WBSWinMorePanel).showPanel(1.2);
    // }

    onClickMenuBtn() {
        if(!this.isGameEnd || wbsgame.sendMgr.readOnly)return;
        this.historyPanel.open();
    }
    protected onDestroy(){this.historyPanel?.destroy();super.onDestroy();}
}
