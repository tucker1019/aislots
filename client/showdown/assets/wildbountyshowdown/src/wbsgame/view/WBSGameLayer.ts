import { Ag3PaytablePage } from '../../rules/paytable_page';
import { ReplayControls } from '../../history/replay_controls';
import { shareFromParent } from '../../history/native_replay_bridge';
import { replayShareURL } from '../../history/replay_share';
import { Ag3History } from '../../history/ag3_history';
import { _decorator, director, Director, sys, Vec3, tween, find, instantiate, Prefab, Node, UIOpacity, Label, SpriteFrame, Texture2D, sp, Animation, easing } from "cc";
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
    popupBigWinPrefab: Prefab = null;
    @property(Prefab)
    popupTriFreePrefab: Prefab = null;
    @property(Prefab)
    popupExtraFreePrefab: Prefab = null;
    @property(Prefab)
    popupEndFreePrefab: Prefab = null;
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
    private replayControls: ReplayControls | null = null;
    private rulesPage: Ag3PaytablePage | null = null;
    firstEnter: boolean = true

    protected onLoad(): void {

        wbsgame.gamelayer = this;
    }

    async start() {
        this.initAttribute();
        this.initBtnClick();
        this.showEntryCover();
        this._loaded = true;
        const images=new Map<number,string>();
        const symbolImage = (symbol: number) => {
            const id=symbol%1000;if(images.has(id))return images.get(id);
            const sf=this.CellSprNor[id];if(!sf)return '';
            const source=sf.texture instanceof Texture2D ? sf.texture.image?.data : null;
            if(!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof ImageBitmap))return '';
            const rect=sf.rect;const canvas=document.createElement('canvas');canvas.width=rect.width;canvas.height=rect.height;
            const ctx=canvas.getContext('2d');if(!ctx)return '';
            if(sf.rotated){ctx.translate(0,rect.height);ctx.rotate(-Math.PI/2);ctx.drawImage(source,rect.x,rect.y,rect.height,rect.width,0,0,rect.height,rect.width);}
            else ctx.drawImage(source,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);
            // Every 350px atlas cell uses the same crop, preserving the game's
            // relative symbol sizes and alignment with the gold frame.
            const output=document.createElement('canvas');
            const inset=50*canvas.width/350;
            const size=250*canvas.width/350;
            output.width=size;output.height=size;
            output.getContext('2d').drawImage(canvas,inset,inset,size,size,0,0,size,size);
            const url=output.toDataURL();images.set(id,url);return url;
        };
        this.rulesPage = new Ag3PaytablePage(document.getElementById('GameCanvas') as HTMLCanvasElement, symbolImage);
        this.historyPanel=new Ag3History(wbsgame.sendMgr.api, symbolImage, () => {
            const music = wbsgame.audioMgr.getMusicPlayingName();
            wbsgame.audioMgr.stopAllSound(); director.pause();
            return () => { if (this.isValid) { director.resume(); if (music) wbsgame.audioMgr.playMusic(music); } };
        });
        this.scheduleOnce(() => {
            this.myGoldBottom.setString(wbsgame.gameMgr.getUserData().coin);
            this.optCtrl.setStartBit();
            const state=wbsgame.sendMgr.progress;
            director.once(Director.EVENT_AFTER_DRAW, () => {
                if (this.isValid) {
                    window.dispatchEvent(new Event('aislots-scene-rendered'));
                    window.dispatchEvent(new Event('aislots-board-ready'));
                }
            });
            if(wbsgame.sendMgr.readOnly){
                this.initNativeReplay();
                return;
            }
            if(state.lastFrame){
                wbsgame.gameMgr.applyFrame(state.lastFrame);
                this.centerRollCtrl.restoreFrame();
            }
            if(state.hasNext){
                this.isGameEnd=false;
                this.optCtrl.updateBtnState(false);
                const resume = () => {
                    if (this.isValid) void this.centerRollCtrl.resumeFrame();
                };
                if (document.getElementById('AG3LoadingCover')) {
                    window.addEventListener('aislots-game-revealed', resume, {once:true});
                    this.node.once(Node.EventType.NODE_DESTROYED, () => window.removeEventListener('aislots-game-revealed', resume));
                } else resume();
            }
            wbsgame.platformMgr.loadingHide();
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




    onClickExitBtn() {
        wbsgame.audioMgr.playSound("menu_icon_press");
        console.log("onClickExitBtn===>>>>", wbsgame.gameMgr.getState())
        if (WBSSTATE.READY == wbsgame.gameMgr.getState() && this.isGameEnd) {
            wbsgame.sendMgr.sendRequestExitRoom();
        } else {
            void wbsgame.loadMgr.showAlert('游戏尚未结束', undefined, '请等待本局结束后再退出。');
        }

    }

    onClickSetExpandBtn() {
        wbsgame.audioMgr.playSound("menu_icon_press")
        let MenuLayer = find("Canvas/SafeLayer/WBSMenuLayer")
        if (MenuLayer) {
            MenuLayer.destroy();
        } else
            wbsgame.loadMgr.showPrefabWithLoading("res/prefab/WBSMenuLayer", find("Canvas/SafeLayer"))
    }


    showEntryCover() {
        this.node.getComponent(UIOpacity).opacity = 0;
        let multPanel = xNodeWBS.find("roll/multPanel", this.node)
        multPanel.active = false;

        let mask = xNodeWBS.find("mask", this.node);
        mask.active = true;
        let endFunc = () => {
            if (wbsgame.sendMgr.readOnly) this.scheduleOnce(() => { void this.beginNativeReplay(); }, 2);


            wbsgame.audioMgr.playSound("bgm_intro");
            this.node.getComponent(UIOpacity).opacity = 255;
            director.once(Director.EVENT_AFTER_DRAW, () => {
                if (this.isValid) window.dispatchEvent(new Event('aislots-game-revealed'));
            });
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
        if (typeof window !== 'undefined' && document.getElementById('AG3LoadingCover')) {
            const begin = () => { if (this.isValid) endFunc(); };
            window.addEventListener('aislots-started', begin, { once: true });
            this.node.once(Node.EventType.NODE_DESTROYED, () => window.removeEventListener('aislots-started', begin));
        } else endFunc();
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

    private initNativeReplay() {
        const session = wbsgame.sendMgr.replaySession;
        const params = new URLSearchParams(location.search), channel = params.get('nativeReplay');
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        this.myGoldBottom.string = '******'; this.optCtrl.updateBtnState(false);
        const share = () => channel ? shareFromParent(channel) : Promise.resolve(replayShareURL(location.href, session.data.bet.betId, params.get('share')));
        const exit = () => {
            if (channel) window.parent.postMessage({type:'ag3-replay-exit',channel},location.origin);
            else wbsgame.platformMgr.exitToPlatform();
        };
        this.replayControls = new ReplayControls(canvas, session.data.bet.betId, exit, {share}, () => {
            if (!this.isGameEnd) return;
            session.restart(); void this.beginNativeReplay(true);
        });
        // Keep native Collect / skip-animation buttons usable; wager handlers are guarded read-only.
        if (channel) window.parent.postMessage({type:'ag3-replay-playing',channel},location.origin);
        wbsgame.sendMgr.onReplayFrame = () => {
            const frame = wbsgame.gameMgr.frame;
            this.replayControls?.progress(session.index,session.length,frame.mode === 'free');
        };
    }
    private async beginNativeReplay(restarting = false) {
        if (!this.isValid || !wbsgame.sendMgr.replaySession || wbsgame.sendMgr.replaySession.index !== -1) return;
        this.isGameEnd = false;
        const mgr = wbsgame.gameMgr;
        mgr.reset();
        const session = wbsgame.sendMgr.replaySession;
        if (restarting) {
            this.centerRollCtrl.showReplayOpening(session.data);
            if (session.data.startBoard) await new Promise<void>(resolve => setTimeout(resolve, 350));
        }
        if (!this.isValid || wbsgame.sendMgr.replaySession !== session) return;
        const frame = await wbsgame.sendMgr.nextFrame();
        if (!this.isValid) return;
        mgr.setState(frame.mode === 'free' ? WBSSTATE.FREEING : WBSSTATE.RUNING);
        this.centerRollCtrl.showFreeBg(frame.mode === 'free');
        this.optCtrl.setAwardNum(0); this.optCtrl.updateBtnState(false);
        this.centerRollCtrl.startRoll();
    }
    completeNativeReplay() {
        this.isGameEnd = true;
        this.optCtrl.updateBtnState(false);
        this.myGoldBottom.string = '******';
        this.replayControls?.done(wbsgame.sendMgr.replaySession.data.bet.status === 'complete' ? '回放结束' : '已播放全部已结算盘面');
    }

    openRules() {
        if (this.isGameEnd && !wbsgame.sendMgr.readOnly && wbsgame.gameMgr.getState() === WBSSTATE.READY) this.rulesPage?.open();
    }
    onClickMenuBtn() {
        if(!this.isGameEnd || wbsgame.sendMgr.readOnly)return;
        this.historyPanel.open();
    }
    protected onDestroy(){wbsgame.sendMgr.onReplayFrame=null;this.replayControls?.destroy();this.rulesPage?.destroy();this.historyPanel?.destroy();super.onDestroy();}
}
