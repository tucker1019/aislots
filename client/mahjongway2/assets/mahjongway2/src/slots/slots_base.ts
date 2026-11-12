import { fitGameOverlay } from './game_overlay';
import { replayShareURL, defaultApiBase } from '../history/replay_share';
import type { HistoryReplay } from '../history/history_types';
import { BottomPanels } from './bottom_panels';
import { loadReplay, ReplaySession } from '../history/replay_session';
import { ReplayControls } from '../history/replay_controls';
import { AutoSpinRunner } from './auto_spin_runner';
import { PaytablePage } from '../rules/paytable_page';
import { AutoSpinPage } from './auto_spin_page';
import { RulesPage } from '../rules/rules_page';
import { initialStrips } from './initial_board';
import { HistoryPage } from '../history/history_page';
import { gameBounds } from '../history/history_model';
import { loadHistoryArt } from '../history/history_assets';
import { RuntimePerformance } from './runtime_performance';
import { GameEffects, bigWinType } from '../effects/game_effects';
import { Anticipation, anticipationColumns } from '../effects/anticipation';
import { _decorator, Component, instantiate, Node, Label, Graphics, Color, UITransform, profiler } from 'cc';
import { slots_r, CELL_HEIGHT } from './slots_r';
import { slots_cell } from './slots_cell';
import { createSpinCellPicker, SpinCellPicker } from './slot_widget';
import { GameApi, Frame } from '../network/game/game_api';
import { serverStrips, gravitySources, cascadeDropDelays, previewRowCount } from './server_board';
const { ccclass, property } = _decorator;

// 相邻列的消除启动间隔（秒），第五列比第一列晚 0.08 秒。
const AWARD_COLUMN_DELAY = 0.02;
// 下落仅对有真实空缺的列从右往左排队，全部变百搭的列不占间隔。
const DROP_COLUMN_DELAY = 0.06;
// 停稳后展示中奖、消除结束后接补落，各停留0.2秒。
const ROUND_TRANSITION_DELAY = 0.2;

@ccclass('slots_base')
export class slots_base extends Component {
    @property(Node)
    cell: Node = null;
    // 0：可操作；1：连接/请求结果；2：转轴或掉落中；3：播放当前轮中奖。
    state = 0;
    fase = 0;
    boards: number[][] = [];
    fast = this.loadFastMode();
    click_stop = false;
    balance = '0';
    betAmount = '0';
    bet = '0';
    betLevel = 1;
    lineCount = 20;
    maxBetLevel = 1;
    winAmount = '0';
    betOptions: string[] = [];
    private betChoices: Array<{ display: string; bet: string; level: number }> = [];
    ready = false;
    error = '';
    private performanceCapture: RuntimePerformance = null;
    private reels: slots_r[] = [];
    private updateCascadeWait?: (dt: number) => void;
    private picks: SpinCellPicker[] = [];
    private api: GameApi;
    private historyPage: HistoryPage = null;
    private rulesPage: RulesPage = null;
    private paytablePage: PaytablePage = null;
    private current: Frame = null;
    private replaySession: ReplaySession = null;
    private replayLoading = false;
    private sharedReplay = false;
    private replayExit: () => void = null;
    get replayActive() { return this.sharedReplay || this.replayLoading || !!this.replaySession; }
    private activeBet = false;
    private alive = true;
    private effects: GameEffects = null;
    private awardShade: Graphics = null;
    private awardEffects: Node = null;
    private anticipation: Anticipation = null;
    private failureDialog: HTMLDivElement = null;
    private retryBanner: HTMLDivElement = null;
    private retryTimer = 0;
    private betOptionsOverlay: HTMLDivElement = null;
    private autoSpinPage: AutoSpinPage = null;
    private autoRunner: AutoSpinRunner = null;
    private freePanelShown = false;
    private freeSpinsLeft = 0;
    get freePanelActive() { return this.freePanelShown; }
    get freeSpinsRemaining() { return this.freeSpinsLeft; }
    get autoSpinRunning() { return this.autoRunner?.active || false; }
    get autoSpinsRemaining() { return this.autoRunner?.remaining || 0; }
    private timers: Array<{
        left: number;
        resolve: () => void;
    }> = [];

    private loadFastMode() {
        try { return localStorage.getItem('aislots-fast-mode') === 'true'; } catch { return false; }
    }

    setFastMode(value: boolean) {
        if (this.replayActive) return;
        this.fast = value;
        try { localStorage.setItem('aislots-fast-mode', String(value)); } catch {}
    }

    /** 先建立连接和特效资源，收到状态前不创建任何 cell。 */
    protected start() {
        // Web 构建可能裁剪 profiler 模块，关闭统计面板不能阻断游戏初始化。
        profiler?.hideStats();
        if (typeof window !== 'undefined') {
            window.addEventListener('aislots-retry', this.showRetryBanner);
            window.addEventListener('aislots-retry-end', this.hideRetryBanner);
        }
        // roll 的 UITransform 同时决定 Mask 范围和触摸区域，沿用编辑器配置。
        if (!this.node.getComponent(UITransform)) this.node.addComponent(UITransform);
        // 捕获阶段接收棋盘输入，避免滚动中的子节点吞掉事件。
        this.node.on(Node.EventType.TOUCH_END, this.onBoardStop, this, true);
        this.node.on(Node.EventType.MOUSE_UP, this.onBoardStop, this, true);
        this.reels = this.node.children.map((n) => n.getComponent(slots_r)).filter(Boolean);
        if (this.reels.length !== 5) {
            throw new Error('场景必须配置5个转轴');
        }
        this.reels.forEach((reel, c) => {
            reel.index = c;
            this.picks[c] = createSpinCellPicker(c);
        });
        const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
        this.sharedReplay = params.has('replay') || params.has('share');
        if (params.get('perf') === '1')
            this.performanceCapture = new RuntimePerformance(this.node.parent);
        this.api = new GameApi(params.get('api') || defaultApiBase(typeof location === 'undefined' ? 'http://127.0.0.1/' : location.href), {
            appname: params.get('appname') || 'test-platform',
            appkey: params.get('appkey') || 'test-app',
            uid: params.get('uid') || 'test-user',
            gameId: 'AG2',
            test: true,
        });
        this.state = 1;
        this.notifyFlowChanged();
        this.effects = this.node.parent.addComponent(GameEffects);
        this.anticipation = new Anticipation(this.reels, (column, visible) =>
            this.effects.setAnticipation(column, visible, this.reels[column].node),
        );
        void this.effects
            .initialize()
            .then(() => {
                if (this.alive) {
                    if (this.sharedReplay) void this.connectSharedReplay(params.get('replay'), params.get('share'));
                    else void this.connect();
                }
            })
            .catch((error) => this.fail(error));
    }

    /** 服务端状态返回后按各列条带长度创建cell，直接赋最终首屏值。 */
    private initializeCells(strips: number[][]) {
        if (this.boards.length) return;
        this.boards = strips;
        this.reels.forEach((reel, c) => {
            for (let i = 0; i < strips[c].length; i++) {
                const cell = instantiate(this.cell);
                reel.node.addChild(cell);
                cell.setPosition(0, CELL_HEIGHT - i * CELL_HEIGHT);
                const component = cell.getComponent(slots_cell);
                component.setBlur(false);
                component.setCellValue(strips[c][i]);
                cell.active = true;
            }
            reel.bindPicker();
        });
        // HTML封面在这批牌真正完成首帧绘制后再关闭。
        if (typeof window !== 'undefined')
            window.dispatchEvent(new CustomEvent('aislots-loading-progress', { detail: { progress: 100 } }));
        if (typeof window !== 'undefined')
            window.dispatchEvent(new Event('aislots-board-ready'));
    }

    /** 通知控制栏刷新按钮，不创建调试文字节点。 */
    private notifyFlowChanged() {
        if (this.alive) {
            this.node.emit('flow-changed');
        }
    }

    private labels() {
        for (const label of this.node.parent.getComponentsInChildren(Label)) {
            if (label.node.name === 'lab_coin') {
                label.string = this.sharedReplay ? '******' : formatMoney(this.balance);
            }
            if (label.node.name === 'lab_bet') {
                label.string = formatMoney(this.betAmount);
            }
            if (label.node.name === 'lab_win') {
                label.string = formatMoney(this.winAmount);
            }
        }
    }

    /** 登录后恢复最后已结算的盘面和累计赢分，再展示消除并请求下一轮。 */
    private async connect() {
        this.state = 1;
        this.notifyFlowChanged();
        try {
            this.reportLoadingProgress(78);
            const login = await this.api.login();
            this.balance = login.balance;
            this.reportLoadingProgress(83);
            const config = await this.api.config();
            this.betChoices = buildBetChoices(config.betOptions, config.lineCount, config.betLevel);
            this.betOptions = this.betChoices.map(choice => choice.display);
            this.lineCount = config.lineCount;
            this.maxBetLevel = config.betLevel;
            const defaultChoice = this.betChoices.find(choice => choice.bet === config.defaultBet && choice.level === 1) || this.betChoices[0];
            this.bet = defaultChoice?.bet || config.defaultBet;
            this.betLevel = defaultChoice?.level || 1;
            this.betAmount = this.totalBet(this.bet, this.betLevel);
            this.reportLoadingProgress(88);
            const state = await this.api.state();
            if (!this.alive) {
                return;
            }
            this.initializeCells(state.lastFrame
                ? serverStrips(state.lastFrame.board, c => this.picks[c]())
                : initialStrips());
            this.balance = state.balance;
            this.ready = true;
            this.activeBet = state.hasNext;
            this.labels();
            if (!state.lastFrame) this.effects?.multiplier(['1', '2', '3', '5'], 0, false);
            if (state.lastFrame) {
                this.betAmount = state.lastFrame.betAmount;
                this.restoreBetChoice(this.betAmount);
                this.winAmount = state.lastFrame.totalWinAmount;
                this.click_stop = false;
                this.labels();
                await this.play({ ...state.lastFrame, balance: state.balance }, true);
            } else if (state.hasNext) {
                this.betAmount = state.betAmount || this.betAmount;
                this.restoreBetChoice(this.betAmount);
                await this.play(await this.api.spin(this.bet, this.betLevel));
            } else {
                this.finish();
            }
        } catch (e) {
            this.fail(e);
        }
    }

    private reportLoadingProgress(progress: number) {
        if (typeof window !== 'undefined')
            window.dispatchEvent(new CustomEvent('aislots-loading-progress', { detail: { progress } }));
    }

    /** HTML记录页复用当前会话，不参与游戏结算或修改盘面。 */
    openPaytable() {
        if (this.replayActive) return;
        if (typeof document === 'undefined') return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        this.historyPage?.close(); this.rulesPage?.close();
        if (!this.paytablePage) this.paytablePage = new PaytablePage(canvas);
        this.paytablePage.open();
    }

    openRules() {
        if (this.replayActive) return;
        if (typeof document === 'undefined') return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        this.historyPage?.close();
        this.paytablePage?.close();
        if (!this.rulesPage) this.rulesPage = new RulesPage(canvas, undefined, () => ({
            bets: [...new Set(this.betChoices.map(choice => choice.bet))],
            levels: [...new Set(this.betChoices.map(choice => choice.level))],
            lineCount: this.lineCount,
        }));
        this.rulesPage.open();
    }

    openHistory() {
        if (this.replayActive) return;
        if (!this.ready || typeof document === 'undefined') return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        if (!this.historyPage)
            this.historyPage = new HistoryPage(
                this.api,
                canvas,
                () => gameBounds(canvas.getBoundingClientRect()),
                loadHistoryArt,
                'IDR',
                record => this.playHistory(record.betId),
                record => this.replayShareLink(record.betId),
            );
        this.rulesPage?.close();
        this.paytablePage?.close();
        this.historyPage.open();
    }

    private replayControls: ReplayControls = null;

    /** 临时借用场景播放历史；退出前等待所有旧异步演出停止，再恢复实时状态。 */
    private async playHistory(betId: string) {
        if (!this.alive || !this.ready || this.replayActive || this.state !== 0 || this.activeBet || this.autoSpinRunning)
            throw new Error('请先等待当前游戏结束，再回放记录');
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        this.replayLoading = true;
        this.notifyFlowChanged();
        try {
            const data = await loadReplay(this.api, betId, () => this.alive && this.historyPage.isOpen);
            if (!this.alive || !this.historyPage.isOpen) return;
            await this.presentReplay(data, canvas);

        } catch (reason) {
            if (this.alive && this.historyPage.isOpen) throw reason;
        } finally { this.replayLoading = false;this.notifyFlowChanged(); }
    }

    private shareLinks = new Map<string, Promise<string>>();
    private replayShareLink(betId: string): Promise<string> {
        let link = this.shareLinks.get(betId);
        if (!link) {
            link = (this.sharedReplay
                ? Promise.resolve(new URLSearchParams(location.search).get('share'))
                : this.api.createReplayShare(betId).then(result => result.shareToken))
                .then(token => replayShareURL(location.href, betId, token))
                .catch(reason => { this.shareLinks.delete(betId); throw reason; });
            this.shareLinks.set(betId, link);
        }
        return link;
    }

    /** 分享页仅加载公开历史，不登录、不读实时state、不恢复任何待结算下注。 */
    private async connectSharedReplay(betId: string, token: string) {
        this.replayLoading = true;
        try {
            if (!betId || !token) throw new Error('分享链接不完整');
            const data = await loadReplay({ historyReplay: (id, cursor) =>
                this.api.sharedReplay(id, token, cursor) }, betId, () => this.alive);
            if (!this.alive) return;
            this.initializeCells(initialStrips());
            this.ready = true;
            // 等待 HTML 首屏封面自动移除，避免在封面后提前播放。
            await this.until(() => !document.getElementById('LoadingScreen') && !document.getElementById('PreviewCover'));
            if (!this.alive) return;
            const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
            await this.presentReplay(data, canvas);
        } catch (reason) {
            if (!this.alive) return;
            this.initializeCells(initialStrips());
            this.state = 0;
            this.labels();
            const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
            this.replayControls = new ReplayControls(canvas, betId || '', () => {
                this.replayControls?.destroy();
                this.replayControls = null;
                void this.connectSharedReplay(betId, token);
            }, { exitLabel: '重试' });
            this.replayControls.done('分享链接无效或暂时无法加载，请重试');
        } finally { this.replayLoading = false; this.notifyFlowChanged(); }
    }

    private async presentReplay(data: HistoryReplay, canvas: HTMLCanvasElement) {
        const betId = data.bet.betId;
        const snapshot = {
            boards: this.boards, current: this.current, balance: this.balance,
            betAmount: this.betAmount, winAmount: this.winAmount, activeBet: this.activeBet,
            freePanelShown: this.freePanelShown, freeSpinsLeft: this.freeSpinsLeft,
            fast: this.fast, click_stop: this.click_stop, state: this.state,
        };
        let session = new ReplaySession(data.frames);
        this.replaySession = session;
        if (!this.sharedReplay) this.historyPage.suspend();
        const restorePanels = this.node.parent.getComponentInChildren?.(BottomPanels)?.beginReplay();
        this.fast = false;
        this.click_stop = false;
        this.winAmount = '0';
        this.balance = subtractAmount(data.frames[0].balance, data.frames[0].winAmount);
        this.betAmount = data.frames[0].betAmount;
        this.labels();
        this.activeBet = false;
        this.freePanelShown = false;
        this.freeSpinsLeft = 0;
        this.hideAwardShade();
        this.effects?.cancelPresentation();
        let exit: () => void;
        const exited = new Promise<void>(resolve => { exit = resolve; });
        let closing = false;
        const cancel = () => {
            session.cancel();
            this.anticipation?.clear();
            this.effects?.cancelPresentation();
            this.hideAwardShade();
            this.reels.forEach(reel => reel.cancelPresentation());
        };
        this.replayExit = () => { closing = true; cancel(); exit(); };
        try {
            let playback: Promise<void>;
            let restarting = false;
            const restart = async () => {
                if (restarting || closing || !this.alive) return;
                restarting = true;
                cancel();
                await playback;
                if (closing || !this.alive) return;
                this.freePanelShown = false;
                this.freeSpinsLeft = 0;
                this.effects?.refreshControls();
                this.effects?.setAudioMode(false);
                this.effects?.releaseFree();
                this.current = null;
                this.boards = initialStrips();
                this.reels.forEach((reel, column) => reel.showBoard(this.boards[column]));
                this.click_stop = false;
                this.winAmount = '0';
                this.balance = subtractAmount(data.frames[0].balance, data.frames[0].winAmount);
                this.betAmount = data.frames[0].betAmount;
                this.labels();
                session = new ReplaySession(data.frames);
                this.replaySession = session;
                playback = run();
                restarting = false;
            };
            this.replayControls = new ReplayControls(canvas, betId,
                this.sharedReplay ? () => void restart() : this.replayExit,
                { share: () => this.replayShareLink(betId), exitLabel: this.sharedReplay ? '重新播放' : '退出回放' });
            const run = () => this.play(session.current, false, session)
                .then(() => {
                    if (session.active) this.replayControls?.done(data.bet.status === 'complete'
                        ? '回放结束' : '已播放当前已结算部分');
                })
                .catch(reason => {
                    this.effects?.cancelPresentation();
                    this.reels.forEach(reel => reel.cancelPresentation());
                    if (session.active) {
                        this.replayControls?.done('回放失败：' + (reason instanceof Error ? reason.message : String(reason)));
                        session.cancel();
                    }
                });
            playback = run();
            await exited;
            await playback;
        } finally {
            session.cancel();
            this.replayControls?.destroy();
            this.replayControls = null;
            this.replayExit = null;
            this.replaySession = null;
            if (this.alive && !this.sharedReplay) {
                Object.assign(this, snapshot);
                this.reels.forEach((reel, c) => reel.showBoard(this.boards[c]));
                this.effects?.setAudioMode(this.current?.mode === 'free' && this.activeBet);
                this.effects?.multiplier(this.current?.cascadeFactors || ['1','2','3','5'],
                    this.current?.cascadeIndex || 0, this.current?.mode === 'free');
                this.labels();
                // 先释放免费面板缓存的可见状态，再恢复回放前的菜单。
                this.effects?.refreshControls();
                if (!snapshot.freePanelShown) this.effects?.releaseFree();
                restorePanels?.();
                this.historyPage.resume();
            }
        }
    }

    /** 总流程忙碌时忽略重复点击，网络异常则保留请求用于重试。 */
    async spin(fromAuto = false): Promise<boolean> {
        if (this.replayActive) return false;
        if (this.autoSpinRunning && !fromAuto) return false;
        if (!this.alive || this.state !== 0) {
            return false;
        }
        if (!this.ready) {
            void this.connect();
            return false;
        }
        const balance = Number(this.balance);
        const stake = Number(this.bet) * this.betLevel * this.lineCount;
        if (Number.isFinite(balance) && Number.isFinite(stake) && balance < stake) {
            this.showInsufficientFundsDialog();
            return false;
        }
        this.state = 1;
        this.click_stop = false;
        this.error = '';
        this.hideAwardShade();
        if (!this.activeBet) { this.effects?.resetBottomWin?.(); this.effects?.resetMultiplier(); this.effects?.spinSound(); }
        this.notifyFlowChanged();
        this.reels.forEach((r) => r.startRoll());
        try {
            await this.play(await this.api.spin(this.bet, this.betLevel), false, undefined, !fromAuto);
            return true;
        } catch (e) {
            this.fail(e);
            return false;
        }
    }

    openAutoSpin() {
        if (this.replayActive) return;
        if (typeof document === 'undefined' || !this.ready || this.state !== 0 || this.autoSpinRunning) return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        if (!this.autoSpinPage) this.autoSpinPage = new AutoSpinPage(
            canvas,
            count => this.startAutoSpin(count),
            () => ({ balance: formatMoney(this.balance), bet: formatMoney(this.betAmount) }),
        );
        this.autoSpinPage.open();
    }

    private startAutoSpin(count: number) {
        if (!this.autoRunner) this.autoRunner = new AutoSpinRunner(
            () => this.spin(true),
            () => this.pause(0.25),
            () => this.alive && this.ready && this.state === 0,
            () => this.notifyFlowChanged(),
        );
        this.autoRunner.start(count);
    }

    /** 自动停止不快停当前转轴、不跳过弹窗，也不改变当前局结算。 */
    stopAutoSpin() { this.autoRunner?.stop(); }

    /** 层级：普通盘面 → 整张黑底 → 中奖动画。 */
    private showAwardShade() {
        if (!this.awardShade) {
            const node = new Node('award_shade');
            node.layer = this.node.layer;
            this.node.addChild(node);
            node.addComponent(UITransform);
            this.awardShade = node.addComponent(Graphics);
            this.awardShade.fillColor = new Color(0, 0, 0, 140);
            this.awardShade.rect(-360, -506.5, 720, 990);
            this.awardShade.fill();
            this.awardEffects = new Node('award_effects');
            this.awardEffects.layer = this.node.layer;
            this.node.addChild(this.awardEffects);
            this.awardEffects.addComponent(UITransform);
        }
        this.awardShade.node.active = true;
        this.awardShade.node.setSiblingIndex(this.node.children.length - 1);
        this.awardEffects.active = true;
        this.awardEffects.setSiblingIndex(this.node.children.length - 1);
    }

    /** 黄框结束即撤掉黑底，翻转动画层继续显示到片段播放完毕。 */
    endAwardHighlight() {
        if (!this.awardShade?.node.active) return;
        this.awardShade.node.active = false;
        this.reels.forEach((reel) => reel.restoreWinLayers());
    }

    /** 按实际列号错峰，同列同步；等待所有列启动后才检查整段消除是否结束。 */
    private async playColumnAwards(frame: Frame, winning: Set<number>, running = () => this.alive) {
        await Promise.all(
            this.reels.map(async (reel, column) => {
                const rows = frame.board[column].flatMap((cell, row) =>
                    winning.has(cell.id) ? [row + 1 - previewRowCount(frame.board)] : [],
                );
                if (!rows.length) return;
                if (column > 0) await this.pause(column * AWARD_COLUMN_DELAY);
                if (!running()) return;
                reel.award(
                    rows,
                    frame.board[column].flatMap((cell, row) =>
                        frame.transformedIds.includes(cell.id) ? [row + 1 - previewRowCount(frame.board)] : [],
                    ),
                    this.awardEffects,
                );
            }),
        );
    }

    private hideAwardShade() {
        if (this.awardShade) this.awardShade.node.active = false;
        if (this.awardEffects) this.awardEffects.active = false;
    }

    private lastBoardInput = '';
    private lastBoardInputAt = -Infinity;

    private onBoardStop(event: { type: string; getButton?: () => number }) {
        if (event.getButton && event.getButton() !== 0) return;
        const now = performance.now();
        // 桌面预览可能同时派发鼠标和模拟触摸；一次点击只能执行一次 Stop。
        if (event.type !== this.lastBoardInput && now - this.lastBoardInputAt < 100) return;
        this.lastBoardInput = event.type;
        this.lastBoardInputAt = now;
        this.stop();
    }

    /** 响应尚未到达时只记录停止意图，不能把客户端随机盘面当成结果。 */
    stop() {
        this.stopAutoSpin();
        if (this.state === 0) {
            return;
        }
        // 补落（含列间等待和落地回弹）不接受 Stop，也不记录停止意图。
        if (this.reels.some((reel) => reel.state === 5)) return;
        if (this.effects?.dismiss()) return;
        this.anticipation?.clear();
        this.effects?.stopTransientAudio();
        this.click_stop = true;
        if (this.state === 2) {
            this.stopReelsWithEffects();
        }
    }

    /** 手动停止不会经过 tick 的停轴状态转换，需要在落位后主动补上演出。 */
    private stopReelsWithEffects() {
        this.effects?.stopTransientAudio();
        // 门槛统一取最后一列，满足前任何列都不能响应这次手动停止。
        const last = this.reels[this.reels.length - 1];
        if (last?.canManualStop === false) return;
        this.reels.forEach((reel) => {
            if (reel.state === 0 || reel.state === 5) return;
            reel.stop();
            reel.playLandingEffects?.();
            if (
                this.current?.board[reel.index]
                    ?.slice(this.current.previewRows ?? previewRowCount(this.current.board))
                    .some((cell) => cell.symbolId === 11)
            ) {
                this.effects?.sound('symbolScatter');
            }
        });
    }

    changeBet(delta: number) {
        if (this.replayActive || this.state !== 0 || this.activeBet || !this.ready) {
            return;
        }
        const i = this.betChoices.findIndex(choice => choice.bet === this.bet && choice.level === this.betLevel);
        const choice = this.betChoices[Math.max(0, Math.min(this.betChoices.length - 1, i + delta))];
        if (choice) { this.bet = choice.bet; this.betLevel = choice.level; }
        this.betAmount = this.totalBet(this.bet, this.betLevel);
        this.labels();
    }

    openBetOptions() {
        if (this.replayActive) return;
        if (typeof document === 'undefined' || !this.ready || this.state !== 0) return;
        this.betOptionsOverlay?.remove();
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const bounds = canvas.getBoundingClientRect();
        const root = document.createElement('div');
        root.className = 'aislot-bet-options';
        root.innerHTML = `<div class="bet-options-panel"><div class="bet-options-header"><h2>投注选项</h2><button class="bet-options-close" aria-label="关闭">×</button></div><div class="bet-options-content"><div class="bet-options-head"><span>投注额</span><i>×</i><span>投注级别</span><i>×</i><span>线路</span><i>=</i><strong>投注总额</strong></div><div class="bet-selector-bg"></div><div class="bet-wheel"><div class="bet-wheel-column bet-wheel-bet"></div><i>×</i><div class="bet-wheel-column bet-wheel-level"></div><i>×</i><div class="bet-wheel-column bet-wheel-lines"><span>${this.lineCount}</span></div><i>=</i><strong class="bet-wheel-total"></strong></div><div class="bet-gradient top"></div><div class="bet-gradient bottom"></div></div><div class="bet-options-actions"><button class="bet-max">最大投注</button><button class="bet-confirm">确认</button></div><div class="bet-options-footer"><span>钱包余额</span><b>${formatMoney(this.balance)}</b><span>投注额</span><b class="bet-footer-amount">${formatMoney(this.betAmount)}</b></div></div>`;
        const panel = root.firstElementChild as HTMLDivElement;
        const choices = this.betChoices.length ? this.betChoices : [{ bet: this.bet, level: this.betLevel, display: this.betAmount }];
        const values = Array.from(new Set(choices.map(item => item.bet)));
        const levels = Array.from(new Set(choices.map(item => item.level)));
        const totals = choices.map(item => item.display);
        let selectedBet = this.bet, selectedLevel = this.betLevel;
        const render = () => {
            const fill = (selector: string, items: Array<string | number>, selected: string | number, pick: (v: string) => void, format: (v: string) => string) => {
                const column = panel.querySelector(selector) as HTMLElement;
                column.replaceChildren();
                items.forEach(value => { const row = document.createElement('button'); row.textContent = format(String(value)); row.className = String(value) === String(selected) ? 'active' : ''; row.onclick = () => { pick(String(value)); render(); }; column.append(row); });
                const active = column.querySelector('.active') as HTMLElement;
                if (active) requestAnimationFrame(() => {
                    column.dataset.syncing = '1';
                    column.scrollTop = active.offsetTop - (column.clientHeight - active.offsetHeight) / 2;
                    requestAnimationFrame(() => delete column.dataset.syncing);
                });
                column.onscroll = () => {
                    if (column.dataset.syncing) return;
                    const center = column.scrollTop + column.clientHeight / 2;
                    const index = Math.max(0, Math.min(items.length - 1, Math.round((center - 64 - 16) / 32)));
                    const value = String(items[index]);
                    if (value !== String(selected)) { pick(value); render(); }
                };
            };
            const updateTotal = () => {
                (panel.querySelector('.bet-footer-amount') as HTMLElement).textContent = formatMoney(this.totalBet(selectedBet, selectedLevel));
            };
            fill('.bet-wheel-bet', values, selectedBet, value => selectedBet = value, value => formatMoney(value));
            fill('.bet-wheel-level', levels, selectedLevel, value => selectedLevel = Number(value), value => value);
            fill('.bet-wheel-total', totals, this.totalBet(selectedBet, selectedLevel), value => {
                const match = choices.find(item => item.display === value);
                if (match) { selectedBet = match.bet; selectedLevel = match.level; }
            }, value => formatMoney(value));
            updateTotal();
            (panel.querySelector('.bet-confirm') as HTMLButtonElement).onclick = () => {
                this.bet = selectedBet; this.betLevel = selectedLevel; this.betAmount = this.totalBet(selectedBet, selectedLevel); this.labels(); close();
            };
        };
        const close = () => { root.classList.remove('visible'); window.setTimeout(() => root.remove(), 220); this.betOptionsOverlay = null; };
        (panel.querySelector('.bet-options-close') as HTMLButtonElement).onclick = close;
        (panel.querySelector('.bet-max') as HTMLButtonElement).onclick = () => { selectedBet = values[values.length - 1]; selectedLevel = levels[levels.length - 1]; render(); };
        render();
        root.style.left = `${bounds.left}px`; root.style.top = `${bounds.top}px`; root.style.width = `${bounds.width}px`; root.style.height = `${bounds.height}px`;
        if (!document.getElementById('aislot-bet-options-style')) {
            const style = document.createElement('style'); style.id = 'aislot-bet-options-style';
            style.textContent = `.aislot-bet-options{position:fixed;z-index:13000;background:rgba(20,20,30,.18);font-family:Nunito,Arial,sans-serif;color:#f5f4f7;overflow:hidden}.bet-options-panel{position:absolute;left:0;right:0;bottom:0;background:#30303c;border-radius:20px 20px 0 0;padding-bottom:7px;transform:translate3d(0,100%,0);transition:transform .25s cubic-bezier(.25,.1,.25,1)}.aislot-bet-options.visible .bet-options-panel{transform:translate3d(0,0,0)}.bet-options-header{height:53px;display:flex;align-items:center;justify-content:center;position:relative}.bet-options-panel h2{margin:8px 0 0;font-size:16px;font-weight:400}.bet-options-close{position:absolute;right:18px;top:11px;border:0;border-radius:50%;width:32px;height:32px;background:#50505d;color:#fff;font-size:25px;line-height:25px}.bet-options-content{position:relative;background:#282833;padding:0 5% 10px;overflow:hidden}.bet-options-head,.bet-wheel{display:grid;grid-template-columns:22.32% 5% 18.855% 5% 17.67% 5% 23.715%;align-items:center;justify-content:space-between;text-align:center;gap:0}.bet-options-head{height:34px;color:#fff;font-size:11px}.bet-options-head span{opacity:.3}.bet-options-head strong{color:#b47850;font-weight:400}.bet-options-head i,.bet-wheel>i{font-style:normal;opacity:.3}.bet-selector-bg{position:absolute;left:4px;right:4px;top:60px;height:36px;background:#30303d;border:1px solid #262633;border-radius:30px}.bet-wheel{height:160px;position:relative;z-index:1}.bet-wheel-column{height:160px;overflow:auto;scrollbar-width:none}.bet-wheel-column::-webkit-scrollbar{display:none}.bet-wheel-column button{display:block;width:100%;height:32px;border:0;background:transparent;color:#fff;font:inherit;font-size:16px;line-height:32px;white-space:nowrap}.bet-wheel-column button.active{color:#fff}.bet-wheel-lines span,.bet-wheel-total{font-size:16px;font-weight:400;color:#fff}.bet-wheel-total{color:#b47850}.bet-gradient{position:absolute;left:5%;right:5%;height:55px;z-index:2;pointer-events:none}.bet-gradient.top{top:30px;background:linear-gradient(#282833 8%,rgba(40,40,51,0))}.bet-gradient.bottom{bottom:8px;background:linear-gradient(0deg,#282833 8%,rgba(40,40,51,0))}.bet-options-actions{display:flex;justify-content:space-between;gap:10px;margin:24px 10px}.bet-options-actions button{height:36px;border-radius:30px;padding:0 12px;font:inherit;font-size:14px}.bet-options-actions .bet-max{width:30%;border:1px solid #b47850;background:#30303d;color:#b47850}.bet-options-actions .bet-confirm{width:67%;border:1px solid #b47850;background:#b47850;color:rgba(255,255,255,.85)}.bet-options-footer{display:flex;justify-content:space-between;align-items:center;margin:0 10px;background:rgba(48,48,60,.7);font-size:12px;color:#aaa;padding:6px 12px;border-radius:16px}.bet-options-footer b{color:#b47850;font-weight:400}`;
            style.textContent += '.bet-wheel-column,.bet-wheel-total{box-sizing:border-box;position:relative;height:160px;overflow:auto;scrollbar-width:none;scroll-snap-type:y mandatory;scroll-padding:64px 0;padding:64px 0}.bet-wheel-column button,.bet-wheel-total button{display:block;width:100%;height:32px;scroll-snap-align:center;border:0;background:transparent;color:#777782;font:inherit;font-size:16px;line-height:32px;white-space:nowrap}.bet-wheel-column button.active,.bet-wheel-total button.active{color:#fff}.bet-wheel-column::-webkit-scrollbar,.bet-wheel-total::-webkit-scrollbar{display:none}.bet-selector-bg{top:96px;height:32px}.bet-wheel-lines{height:160px;padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;transform:none}.bet-wheel-lines span{display:block;height:32px;line-height:32px}.bet-wheel-total{color:#b47850;font-weight:400;transform:none}.bet-wheel-total button{color:#777782}.bet-wheel-total button.active{color:#fff}';
            document.head.append(style);
        }
        document.body.append(root); fitGameOverlay(root, canvas, 414); this.betOptionsOverlay = root; requestAnimationFrame(() => root.classList.add('visible'));
    }

    private totalBet(bet: string, level: number) {
        try { return (BigInt(bet) * BigInt(level) * BigInt(this.lineCount)).toString(); }
        catch { return '0'; }
    }

    private restoreBetChoice(total: string) {
        const choice = this.betChoices.find(item => this.totalBet(item.bet, item.level) === String(total));
        if (choice) { this.bet = choice.bet; this.betLevel = choice.level; }
    }

    /** 服务端决定中奖和余额；这里只安排停轴、消除及下一轮的展示顺序。 */
    showSymbolTooltip(cell: Node, value: number) {
        if (this.replayActive || !this.ready || this.state !== 0 || this.autoSpinRunning || value <= 0) return false;
        const column = this.reels.findIndex(reel => reel.node === cell.parent);
        if (column < 0 || this.reels[column].activeRowForCell(cell) < 0) return false;
        this.effects?.showSymbolTooltip(cell, value, column);
        return true;
    }

    reelStopped(quick: boolean) { this.effects?.reelStopped(quick); }

    private async play(frame: Frame, restore = false, replay?: ReplaySession, manualSpin = false) {
        const running = () => this.alive && (!replay || replay.active);
        let first = true;
        while (running()) {
            if (replay) this.replayControls?.progress(replay.index, replay.frames.length, frame.mode === 'free');
            const previous = this.current,
                cascade =
                    !first &&
                    previous &&
                    previous.betId === frame.betId &&
                    previous.spinIndex === frame.spinIndex;
            const strips = serverStrips(
                frame.board,
                (c) => this.picks[c](),
                cascade || (restore && first) ? this.boards : undefined,
            );
            // 触发页先显示再加载；恢复到进行中的免费局时也必须先准备资源。
            if (frame.mode === 'free' && !(restore && first && frame.nextAction === 'complete')) {
                await this.effects?.prepareFree();
                if (!running()) return;
            }
            this.effects?.setAudioMode(frame.mode === 'free' && !(restore && first && frame.nextAction === 'complete'));
            if (frame.mode === 'free' && !(restore && first && frame.nextAction === 'complete')) {
                this.freePanelShown = true;
                if (frame.triggeredFree) {
                    // 服务端从首帧就包含追加次数，等追加提示结束后再显示。
                    const beforeAward = frame.awardedFreeSpins === undefined
                        ? this.freeSpinsLeft - (cascade ? 0 : 1)
                        : frame.freeRemaining - frame.awardedFreeSpins;
                    this.freeSpinsLeft = Math.max(0, beforeAward);
                } else {
                    this.freeSpinsLeft = frame.freeRemaining;
                }
            }
            this.current = frame;
            this.boards = strips;
            this.activeBet = frame.nextAction !== 'complete';
            if (restore && first) {
                this.anticipation?.clear();
                this.reels.forEach((reel, c) => reel.showBoard(strips[c]));
                this.state = 2;
            } else if (cascade) {
                this.anticipation?.clear();
                this.effects?.multiplier(frame.cascadeFactors, frame.cascadeIndex ?? 0, frame.mode === 'free', true);
                this.effects?.sound('symbolCollapse');
                const sources = gravitySources(previous.board, frame.board);
                const delays = cascadeDropDelays(sources, DROP_COLUMN_DELAY);
                this.reels.forEach((reel, c) => {
                    const seen = new Set(
                        previous.board[c].slice(previous.previewRows ?? previewRowCount(previous.board)).map((cell) => cell.id),
                    );
                    reel.dropTo(
                        strips[c],
                        sources[c],
                        frame.board[c].map((cell) => !seen.has(cell.id)),
                        delays[c],
                    );
                });
                this.state = 2;
            } else {
                // Stop 只作用于当前旋转；自动进入下一免费局时重新允许完整转轴过程。
                // 第一帧仍保留请求期间的手动停止意图。
                if (!first) this.click_stop = false;
                this.effects?.resetBottomWin?.();
                // 新一局（包含免费局）在转轴开始时切换倍率，续传则使用实际档位。
                this.effects?.multiplier(
                    frame.cascadeFactors,
                    frame.cascadeIndex ?? 0,
                    frame.mode === 'free',
                );
                if (!this.reels.some((r) => r.state !== 0)) {
                    this.effects?.spinSound();
                    this.reels.forEach((r) => r.startRoll());
                }
                // 原项目先开转，再并行演出；飞龙期间保持滚动，不提前送入停轴盘面。
                if (frame.mode === 'free') {
                    if (previous?.mode !== 'free') this.effects?.queueFreeDragon();
                    await this.effects?.playFreeDragon();
                    if (!running()) return;
                }
                this.reels.forEach((r, c) => r.stopRoll(strips[c]));
                this.anticipation?.begin(
                    anticipationColumns(
                        frame.board,
                        frame.mode === 'free',
                        this.fast || this.click_stop,
                        frame.previewRows ?? previewRowCount(frame.board),
                    ),
                );
                this.state = 2;
                if (this.click_stop) {
                    this.stopReelsWithEffects();
                }
            }
            await this.until(() => this.reels.every((r) => r.state === 0), running);
            if (!running()) {
                return;
            }
            this.anticipation?.clear();
            this.effects?.multiplier(
                frame.cascadeFactors,
                frame.cascadeIndex ?? 0,
                frame.mode === 'free',
            );
            this.state = 3;
            // 先展示本轮中奖前的余额（服务端余额扣除了本轮 win）。
            // 后续在中奖动画结束后，再把余额和累计赢分滚到当前轮的最终值。
            const beforeWinBalance = subtractAmount(frame.balance, frame.winAmount);
            if (first && !restore) {
                this.balance = beforeWinBalance;
                this.winAmount = '0';
            } else if (cascade) {
                this.balance = beforeWinBalance;
            }
            this.betAmount = frame.betAmount;
            this.labels();
            this.notifyFlowChanged();
            const winning = new Set(frame.wins.flatMap((w) => w.cellIds));
            if (frame.mode === 'free' && frame.board[2]?.some(cell => winning.has(cell.id))) this.effects?.queueFreeDragon();
            if (manualSpin && first && frame.mode === 'base' && frame.nextAction === 'complete'
                && !winning.size && Number(frame.spinWinAmount) === 0) {
                this.balance = frame.balance;
                this.winAmount = frame.totalWinAmount;
                this.labels();
                this.finish();
                return;
            }
            if (winning.size) {
                await this.pause(ROUND_TRANSITION_DELAY);
                if (!running()) return;
                this.showAwardShade();
                this.effects?.awardSound(frame.wins.map(win => win.symbolId), frame.transformedIds.length > 0);
                await this.playColumnAwards(frame, winning, running);
                await this.until(() => this.reels.every((reel) => !reel.isAwardPlaying), running);
                if (!running()) return;
                this.hideAwardShade();
                await this.pause(ROUND_TRANSITION_DELAY);
                if (!running()) return;

            } else {
                await this.pause(0.2);
            }
            if (!running()) {
                return;
            }
            if (winning.size && Number(frame.winAmount) > 0) {
                const tier = Number(frame.winAmount) >= Number(frame.betAmount) * 3 ? 2 : 1;
                this.effects?.showBottomWin?.(formatMoney(frame.winAmount), tier, false);
            }
            await this.rollSettlement(frame, running);
            if (!running()) return;
            // 已结束的下注只恢复静态结果，不在每次刷新时重播大奖或免费结算弹窗。
            if (restore && first && frame.nextAction === 'complete') {
                this.finish();
                return;
            }
            if (!winning.size && Number(frame.spinWinAmount) > 0) {
                const type = bigWinType(frame.spinWinAmount, frame.betAmount);
                if (type > 0) await this.effects?.bigWin(frame.spinWinAmount, type, frame.betAmount);
                if (!running()) return;
                const tier = type > 0 ? 3 : Number(frame.spinWinAmount) >= Number(frame.betAmount) * 3 ? 2 : 1;
                const stake = BigInt(frame.betAmount);
                const count = type === 0 && stake > 0n && BigInt(frame.spinWinAmount) >= stake * 5n
                    ? { minor: frame.spinWinAmount, seconds: 0.8 }
                    : undefined;
                const totalWinSeconds = this.effects?.showBottomWin?.(formatMoney(frame.spinWinAmount), tier, true, count);
                if (totalWinSeconds) await this.pause(totalWinSeconds);
            }
            if (!running()) return;
            if (frame.nextAction === 'complete') {
                if (frame.mode === 'free') {
                    await this.effects?.freeEnd(frame.totalWinAmount);
                    if (!running()) return;
                    this.effects?.setAudioMode(false);
                }
                this.finish();
                return;
            }
            if (frame.nextAction === 'start_free') {
                if (frame.mode === 'base') {
                    await this.effects?.intro(frame.freeRemaining, !!replay);
                    if (!running()) return;
                    await this.effects?.enterFreeMultipliers();
                }
                else if (frame.triggeredFree) {
                    await this.effects?.retrigger(frame.awardedFreeSpins ?? frame.freeRemaining);
                    await this.countAddedFreeSpins(frame.freeRemaining, running);
                }
                if (!running()) return;
                this.freePanelShown = true;
                this.freeSpinsLeft = frame.freeRemaining;
            }
            if (!running()) return;
            this.notifyFlowChanged();
            // 回放永远从历史队列取帧，禁止退回实时开奖接口。
            frame = replay ? replay.advance() : await this.requestNextFrame(frame.nextAction === 'continue');
            if (!frame) { this.finish(); return; }
            first = false;
        }
    }

    private async requestNextFrame(waitingForCascade: boolean) {
        if (!waitingForCascade) return this.api.spin(this.bet, this.betLevel);

        const cells = this.reels.flatMap(reel => reel.node.children
            .filter(node => node.active && node.getComponent(slots_cell))
            .map(node => {
                const { x, y, z } = node.position;
                return { node, x, y, z };
            }));
        let elapsed = 0;
        let shaking = false;
        this.updateCascadeWait = dt => {
            elapsed += dt;
            if (elapsed < 1) return;
            shaking = true;
            cells.forEach(({ node, x, y, z }, index) => {
                const time = elapsed - 1 - index * 0.013;
                if (time < 0) return;
                const offset = 1.5 * Math.sin(time * 2 * Math.PI * 5);
                node.setPosition(x + offset, y, z);
            });
        };
        try {
            return await this.api.spin(this.bet, this.betLevel);
        } finally {
            this.updateCascadeWait = undefined;
            if (this.alive && shaking) {
                cells.forEach(({ node, x, y, z }) => node.setPosition(x, y, z));
            }
        }
    }

    private async countAddedFreeSpins(target: number, running: () => boolean) {
        while (running() && this.freeSpinsLeft < target) {
            for (const lift of [8, 14]) {
                this.effects?.setFreeCounterLift(lift);
                await this.pause(0.016);
                if (!running()) return;
            }
            this.freeSpinsLeft++;
            this.notifyFlowChanged();
            for (const lift of [9, 4, 0]) {
                this.effects?.setFreeCounterLift(lift);
                await this.pause(0.016);
                if (!running()) return;
            }
        }
    }

    /** 中奖阶段结束后，将本轮余额和累计赢分平滑滚动到服务端结果。 */
    private async rollSettlement(frame: Frame, running = () => this.alive) {
        const startBalance = this.balance;
        const startWin = this.winAmount;
        const endBalance = frame.balance;
        const endWin = frame.totalWinAmount;
        const steps = 8;
        for (let i = 1; i <= steps && running(); i++) {
            this.balance = interpolateAmount(startBalance, endBalance, i, steps);
            this.winAmount = interpolateAmount(startWin, endWin, i, steps);
            this.labels();
            await this.pause(0.02);
        }
        if (!running()) return;
        this.balance = endBalance;
        this.winAmount = endWin;
        this.labels();
    }

    // 使用引擎 update 计时，暂停或销毁场景时不会遗留独立的 JS 定时器。
    private pause(seconds: number) {
        return new Promise<void>((resolve) => this.timers.push({ left: seconds, resolve }));
    }

    private async until(test: () => boolean, running = () => this.alive) {
        while (running() && !test()) {
            await this.pause(0.016);
        }
    }

    private finish() {
        this.freePanelShown = false;
        this.freeSpinsLeft = 0;
        this.anticipation?.clear();
        this.state = 0;
        this.click_stop = false;
        this.notifyFlowChanged();
        this.effects?.setAudioMode(false);
        this.effects?.releaseFree();
    }

    /** 出错后恢复操作和静止盘面，避免无结果时无限滚动。 */
    private fail(e: unknown) {
        if (!this.alive) {
            return;
        }
        console.error(e);
        this.anticipation?.clear();
        const progress = (e as any)?.progress;
        if (progress) {
            this.balance = progress.balance;
            this.activeBet = progress.hasNext;
            if (progress.betAmount) {
                this.betAmount = progress.betAmount;
            }
            this.labels();
        }
        this.hideAwardShade();
        // No server frame means no authoritative result. Keep reels moving; only
        // the retry banner/dialog changes, and STOP remains an intent for a later frame.
        this.state = 1;
        this.error = e instanceof Error ? e.message : String(e);
        this.showFailureDialog();
        this.notifyFlowChanged();
    }

    private showFailureDialog() {
        if (typeof document === 'undefined' || this.failureDialog) return;
        const root = document.createElement('div');
        root.style.cssText = 'position:absolute;inset:0;z-index:10000;container-type:size;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:#202124;';
        const content = document.createElement('div');
        content.style.cssText = 'width:84%;background:#fff;border:1px solid #d9dce1;border-radius:1%;box-shadow:0 2% 6% rgba(0,0,0,.24);padding:0;text-align:center;overflow:hidden;';
        content.innerHTML = '<div style="padding:4% 4% 2%;font-size:clamp(14px,4.8cqw,24px);font-weight:700;color:#202124;">请求失败</div>' +
            '<div style="padding:0 6% 4%;line-height:1.6;font-size:clamp(11px,3.2cqw,16px);color:#5f6368;">暂时无法连接游戏服务，请检查网络后重试。</div>' +
            '<div style="height:1px;background:#e5e7eb;"></div>';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '重试';
        button.style.cssText = 'display:block;width:100%;border:0;background:#fff;color:#c88719;padding:4%;font-size:clamp(12px,3.6cqw,18px);font-weight:600;cursor:pointer;';
        button.addEventListener('click', () => {
            root.remove();
            this.failureDialog = null;
            this.error = '';
            if (this.sharedReplay) location.reload();
            else this.connect();
        });
        content.appendChild(button);
        root.appendChild(content);
        const game = document.getElementById('GameDiv');
        if (!game) return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        document.body.appendChild(root);
        fitGameOverlay(root, canvas);
        this.failureDialog = root;
    }

    private showInsufficientFundsDialog() {
        if (typeof document === 'undefined' || this.failureDialog) return;
        const root = document.createElement('div');
        root.style.cssText = 'position:absolute;inset:0;z-index:10000;container-type:size;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:#fff;';
        const content = document.createElement('div');
        content.style.cssText = 'box-sizing:border-box;width:70%;background:rgba(40,40,52,.96);border-radius:1em;padding:5% 5% 4%;text-align:center;overflow:hidden;';
        content.innerHTML = '<div style="font-size:clamp(16px,4.8cqw,24px);font-weight:500;margin-bottom:5%;">余额不足</div>' +
            '<div style="line-height:1.55;font-size:clamp(12px,3.4cqw,17px);color:#bdbbc3;">请充值后再试。</div>';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '确定';
        button.style.cssText = 'display:block;width:70%;margin:6% auto 0;border:0;border-radius:2em;background:#c8874f;color:#202124;padding:3%;font-size:clamp(13px,3.6cqw,18px);cursor:pointer;';
        button.addEventListener('click', () => { root.remove(); this.failureDialog = null; });
        content.appendChild(button);
        root.appendChild(content);
        const game = document.getElementById('GameDiv');
        if (!game) return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        document.body.appendChild(root);
        fitGameOverlay(root, canvas);
        this.failureDialog = root;
    }

    private showRetryBanner = (event: Event) => {
        const detail = (event as CustomEvent).detail || {};
        const game = document.getElementById('GameDiv');
        if (!game) return;
        if (!this.retryBanner) {
            const style = document.createElement('style');
            style.textContent = '@keyframes aislotRetryDot { 0%,60%,100% { transform:translateY(0); opacity:.35 } 30% { transform:translateY(-.28em); opacity:1 } } .retry-dots { display:inline-flex; gap:.08em; margin-left:.12em; vertical-align:baseline } .retry-dots i { font-style:normal; animation:aislotRetryDot 1.05s infinite; } .retry-dots i:nth-child(2) { animation-delay:.14s } .retry-dots i:nth-child(3) { animation-delay:.28s }';
            document.head.appendChild(style);
            this.retryBanner = document.createElement('div');
            this.retryBanner.style.cssText = 'position:absolute;left:10%;bottom:3%;z-index:10001;width:80%;box-sizing:border-box;background:rgba(28,28,32,.94);border:1px solid rgba(255,255,255,.16);border-radius:.75em;box-shadow:0 2% 5% rgba(0,0,0,.3);color:#eee;text-align:center;padding:2% 3%;font-size:clamp(11px,3.2cqw,16px);line-height:1.4;white-space:nowrap;pointer-events:none;';
            if (getComputedStyle(game).position === 'static') game.style.position = 'relative';
            game.appendChild(this.retryBanner);
        }
        let remaining = Math.ceil(Number(detail.delay || 0) / 1000);
        const attempt = Number(detail.attempt || 1);
        this.retryBanner.innerHTML = `第 ${attempt} 次重试中，${remaining} 秒后重试 <span class="retry-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>`;
        window.clearInterval(this.retryTimer);
        this.retryTimer = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                window.clearInterval(this.retryTimer);
                this.retryTimer = 0;
                return;
            }
            if (this.retryBanner) this.retryBanner.innerHTML = `第 ${attempt} 次重试中，${remaining} 秒后重试 <span class="retry-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>`;
        }, 1000);
    };

    private hideRetryBanner = () => {
        if (this.retryTimer) window.clearInterval(this.retryTimer);
        this.retryTimer = 0;
        this.retryBanner?.remove();
        this.retryBanner = null;
    };

    protected onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onBoardStop, this, true);
        this.node.off(Node.EventType.MOUSE_UP, this.onBoardStop, this, true);
        this.replayExit?.();
        this.stopAutoSpin();
        this.historyPage?.destroy();
        this.rulesPage?.destroy();
        this.paytablePage?.destroy();
        this.autoSpinPage?.close();
        this.performanceCapture?.destroy();
        this.alive = false;
        this.failureDialog?.remove();
        this.hideRetryBanner();
        if (typeof window !== 'undefined') {
            window.removeEventListener('aislots-retry', this.showRetryBanner);
            window.removeEventListener('aislots-retry-end', this.hideRetryBanner);
        }
        for (const timer of this.timers) {
            timer.resolve();
        }
        this.timers = [];
    }

    /** 大帧拆成小步推进转轴，避免低帧率时一次跨过多个回卷边界。 */
    update(dt: number) {
        this.updateCascadeWait?.(dt);
        this.performanceCapture?.setPhase(
            this.reels.some((r) => r.state === 5)
                ? 'cascade'
                : this.reels.some((r) => r.state !== 0)
                  ? 'rolling'
                  : this.state === 3
                    ? 'award'
                    : this.state === 1
                      ? 'request'
                      : 'idle',
        );
        dt = Math.min(Math.max(dt, 0), 0.1);
        if (this.fast) this.anticipation?.clear();
        else if (this.state === 2) this.anticipation?.tick();
        for (let remaining = dt; remaining > 0; ) {
            const step = Math.min(remaining, 1 / 60);
            this.reels.forEach((r) => {
                const previous = r.state;
                r.tick(step * (this.fast ? 2 : 1), step);
                if (previous !== 0 && previous !== 5 && r.state === 0) {
                    r.playLandingEffects?.();
                    if (
                        this.current?.board[r.index]
                            ?.slice(this.current.previewRows ?? previewRowCount(this.current.board))
                            .some((cell) => cell.symbolId === 11)
                    )
                        this.effects?.sound('symbolScatter');
                }
            });
            // 所有列先推进同一小步，再统一判断，避免在遍历中提前停掉前面的列。
            if (this.click_stop && this.state === 2 && !this.reels.some((r) => r.state === 5)) {
                this.stopReelsWithEffects();
            }
            remaining -= step;
        }
        const timers = this.timers;
        this.timers = [];
        for (const timer of timers) {
            timer.left -= dt;
            if (timer.left <= 0) {
                timer.resolve();
            } else {
                this.timers.push(timer);
            }
        }
    }
}

function formatMoney(raw: string): string {
    try {
        const value = BigInt(raw);
        const negative = value < 0n;
        const absolute = negative ? -value : value;
        return (negative ? '-' : '') + (Number(absolute) / 100).toFixed(2);
    } catch { return '—'; }
}

function subtractAmount(value: string, amount: string): string {
    try { return (BigInt(value || '0') - BigInt(amount || '0')).toString(); }
    catch { return value || '0'; }
}

function interpolateAmount(from: string, to: string, step: number, steps: number): string {
    try {
        const start = BigInt(from || '0');
        const end = BigInt(to || '0');
        return (start + ((end - start) * BigInt(step)) / BigInt(steps)).toString();
    } catch { return step >= steps ? to : from; }
}

function buildBetChoices(bets: string[], lineCount: number, maxLevel: number) {
    const result = new Map<string, { display: string; bet: string; level: number }>();
    for (const bet of bets) {
        for (let level = 1; level <= Math.max(1, maxLevel); level++) {
            try {
                const display = (BigInt(bet) * BigInt(lineCount) * BigInt(level)).toString();
                if (!result.has(display)) result.set(display, { display, bet, level });
            } catch { /* invalid server data is ignored until config validation reports it */ }
        }
    }
    return Array.from(result.values()).sort((a, b) => BigInt(a.display) < BigInt(b.display) ? -1 : 1);
}
