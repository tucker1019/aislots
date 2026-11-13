const { ccclass, property } = _decorator;
import { _decorator, ProgressBar, Asset, AudioSource, game, JsonAsset, setDisplayStats, Widget, UITransform, sys, math, View, view, ResolutionPolicy, Label, sp, UIOpacity, tween, Vec3 } from 'cc';
import { loginS2C, requestEnterGameS2C } from '../../3rd/hall';
import FTLoadManager from '../../load/FTLoadManager';

import { xNodeFT } from '../../../xtools/xNodeFT';

import { FTNetConfig } from '../../net/FTNetConfig';
import FTNetController from '../../net/FTNetController';
import FTSendManager from '../../net/FTSendManager';
import { FTBaseScene } from '../../base/FTBaseScene';
import { FTGlobal } from '../layer/FTGlobal';

import { FTPlatformMgr } from '../../3rd/FTPlatformMgr';
import { debugLog, exitToLogin, exitToPlatform, getUrlParam, isWeb, longToNumber } from '../../common/FTUtils';
import { ftframe } from '../../../ftframe/ftframe';
import { FTNetManager } from '../../../ftframe/network/FTNetManager';
import { FTAudioManager } from '../../../ftframe/audio/FTAudioManager';
import { FTConstant } from '../../FTConstant/FTConstant';
import Long from '../../3rd/Long';
import { FTConfigCtrl } from '../layer/FTConfigCtrl';
import { FTLanguage } from '../layer/FTLanguage';
import GameBridge from '../../../../../game.bridge';
import { getGameStateS2C } from '../../3rd/game_1017';
import { goSession } from '../../net/FTGoSession';
import { FTGameManager } from '../../mgr/FTGameManager';


// 对应大厅，平台要求
@ccclass('FTLogin')
export class FTLogin extends FTBaseScene {
    @property(ProgressBar)
    bar: ProgressBar = null;
    @property(Label)
    rateLab: Label = null;
    @property(Label)
    tipLab: Label = null;
    @property(sp.Skeleton)
    skeleton: sp.Skeleton = null;
    private isLoadComplete: boolean = false
    private isEnterGameReceived: boolean = false
    async onLoad() {

        let actual_size = view.getVisibleSizeInPixel();
        let design_resolution = view.getDesignResolutionSize();
        if (design_resolution.height / design_resolution.width >= actual_size.height / actual_size.width) FTGlobal.ADAPTATION = ResolutionPolicy.FIXED_HEIGHT
        else FTGlobal.ADAPTATION = ResolutionPolicy.FIXED_WIDTH
        view.setResolutionPolicy(FTGlobal.ADAPTATION)


        GameBridge.callNoReturnValue('START_LOADING');
        setDisplayStats(false);
        super.onLoad();
        this.skeleton.setAnimation(0, "1", false);
        this.skeleton.setCompleteListener((trackEntry: any) => {
            console.log("setCompleteListener", trackEntry)
            this.skeleton.setAnimation(0, "xh", true);
        });
        this.scheduleOnce(() => {
            this.tipLab.string = "If this is your first visit, downloading may take a while";
            let startY = this.tipLab.node.position.y;
            this.tipLab.node.setPosition(0, startY - 40);
            let opaComp = this.tipLab.node.getComponent(UIOpacity);
            opaComp.opacity = 0;
            tween(opaComp)
                .to(0.6, { opacity: 255 })
                .delay(1.8)
                .to(0.6, { opacity: 0 })
                .start()
            tween(this.tipLab.node)
                .to(.6, { position: new Vec3(0, startY, 0) })
                .delay(1.8)
                .to(.6, { position: new Vec3(0, startY + 40, 0) })
                .start()
        })
        let resut: boolean = FTLoadManager.ins.init();
        if (!resut) {
            ftframe.log.logError("bundle加载失败");
            return
        }
        this.initConfig()
        this.initAttribute();
        FTConstant.languagePath = `res/load/image/language/${FTPlatformMgr.getLanguage()}/`
        FTLoadManager.ins.hideLoading();
        void this.initGo()
        await this.preLoadDir();
        this.isLoadComplete = true;
        this.tryEnterGame()




    }
    tryEnterGame() {
        if (this.isLoadComplete && this.isEnterGameReceived) {
            FTLoadManager.ins.loadScene("FTGameScene")
        }
    }
    initConfig() {
        // 获取所有 URL 参数
        let urlParams = getUrlParam();

        // 使用参数
        if (urlParams) {

            if (urlParams["uid"]) {
                FTGlobal.USER.uid = urlParams["uid"];
            }
            if (urlParams["sid"]) {
                FTGlobal.USER.accessToken = urlParams["sid"];
            }
            if (urlParams["debugLog"]) {
                FTGlobal.debugLog = urlParams["debugLog"] === "true";
            }
            if (urlParams["countryCode"]) {
                FTGlobal.COUNTRYCODE = urlParams["countryCode"];
            }
            if (urlParams["lang"]) {
                FTGlobal.LANG = urlParams["lang"];
            }
            if (urlParams["wss"]) {
                FTGlobal.wss = urlParams["wss"];
            }
            if (urlParams["appId"]) {
                FTGlobal.APPID = urlParams["appId"];
            }
            if (urlParams["env"]) {
                FTGlobal.env = urlParams["env"];
            }
            if (urlParams["playerType"] != null) {
                FTGlobal.playerType = parseInt(urlParams["playerType"]);
            }   if (urlParams["isPoint"] != null) {
                FTGlobal.isPoint = parseInt(urlParams["isPoint"]);
            }
            debugLog('URL参数:', urlParams);
        }
        debugLog("urlParams", urlParams)
    }

    protected initAttribute() {

    }
    private async preLoadDir() {
        return new Promise((resolve, reject) => {
            FTLoadManager.ins.preLoadDir(
                (completedCount: number, totalCount: number) => {
                    let beforProgress = xNodeFT.getProperty("GameLayer/ProgressBar", this.node, ProgressBar, "progress", 0);
                    let progress: number = completedCount / totalCount;
                    if (progress > beforProgress) {
                        xNodeFT.setLabel("GameLayer/retaLab", this.node, `${FTConfigCtrl.Instance.getLanguageText(FTLanguage.LOAD_TIT1)} [${(progress * 100).toFixed(2)}%]`)
                        xNodeFT.setProperty("GameLayer/ProgressBar", this.node, ProgressBar, "progress", progress);
                    }
                },
                (error: Error, assets: Asset[]) => {
                    if (error) {
                        ftframe.log.logError(error, "StartScene.ts /preLoadDir");
                        return
                    }


                    resolve(true)
                })
        })
    }


    private async initGo() {
        try {
            FTGlobal.isPoint = 1;
            ftframe.audio = FTAudioManager.instance;
            const params = new URLSearchParams(location.search);
            const replay = params.get('replay');
            if (replay) {
                const data = await goSession.readReplay(replay, params.get('share'));
                goSession.entry = { replay: data };
                FTGameManager.setMultiples([data.betAmount / 5]);
                FTGameManager.setAllMultiples([data.betAmount]);
            } else {
                const data = await goSession.connect();
                goSession.entry = { live: data };
                FTGlobal.USER.uid = data.uid;
                FTGlobal.USER.gold = data.state.balance;
                FTGlobal.coinSymbol = data.policy.currency;
                FTGameManager.setGoBetLevels(data.policy.betLevel);
                FTGameManager.setMultiples(data.policy.betOptions.map(Number));
                FTGameManager.setAllMultiples(data.policy.betOptions.map(bet => Number(bet) * 5));
            }
            FTGameManager.setTotalBitList();
            this.isEnterGameReceived = true;
            this.tryEnterGame();
        } catch (error) {
            FTLoadManager.ins.showAlertWithInit(error.message, () => location.reload());
        }
    }
}
