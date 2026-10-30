import { PaytablePage } from '../rules/paytable_page';
import { RulesPage } from '../rules/rules_page';
import { initialStrips } from './initial_board';
import { HistoryPage } from '../history/history_page';
import { gameBounds } from '../history/history_model';
import { loadHistoryArt } from '../history/history_assets';
import { RuntimePerformance } from './runtime_performance';
import { GameEffects, bigWinType } from '../effects/game_effects';
import { Anticipation, anticipationColumns } from '../effects/anticipation';
import { _decorator, Component, instantiate, Node, Label, Graphics, Color, UITransform } from 'cc';
import { slots_r } from './slots_r';
import { slots_cell } from './slots_cell';
import { createSpinCellPicker, SpinCellPicker } from './slot_widget';
import { GameApi, Frame } from '../network/game/game_api';
import { serverStrips, gravitySources, cascadeDropDelays } from './server_board';
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
    fast = false;
    click_stop = false;
    balance = '0';
    betAmount = '200';
    winAmount = '0';
    betOptions: string[] = [];
    ready = false;
    error = '';
    private performanceCapture: RuntimePerformance = null;
    private reels: slots_r[] = [];
    private picks: SpinCellPicker[] = [];
    private api: GameApi;
    private historyPage: HistoryPage = null;
    private rulesPage: RulesPage = null;
    private paytablePage: PaytablePage = null;
    private current: Frame = null;
    private activeBet = false;
    private alive = true;
    private effects: GameEffects = null;
    private awardShade: Graphics = null;
    private awardEffects: Node = null;
    private anticipation: Anticipation = null;
    private timers: Array<{
        left: number;
        resolve: () => void;
    }> = [];

    /** 先建立连接和特效资源，收到状态前不创建任何 cell。 */
    protected start() {
        this.reels = this.node.children.map((n) => n.getComponent(slots_r)).filter(Boolean);
        if (this.reels.length !== 5) {
            throw new Error('场景必须配置5个转轴');
        }
        this.reels.forEach((reel, c) => {
            reel.index = c;
            this.picks[c] = createSpinCellPicker(c);
        });
        const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
        if (params.get('perf') === '1')
            this.performanceCapture = new RuntimePerformance(this.node.parent);
        this.api = new GameApi(params.get('api') || 'http://127.0.0.1:8080', {
            appname: params.get('appname') || 'test-platform',
            appkey: params.get('appkey') || 'test-app',
            uid: params.get('uid') || 'test-user',
            gameId: 'AG1',
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
                    void this.connect();
                }
            })
            .catch((error) => this.fail(error));
    }

    /** 服务端状态返回后只创建一次35个cell，直接赋最终首屏值。 */
    private initializeCells(strips: number[][]) {
        if (this.boards.length) return;
        this.boards = strips;
        this.reels.forEach((reel, c) => {
            for (let i = 0; i < 7; i++) {
                const cell = instantiate(this.cell);
                reel.node.addChild(cell);
                cell.setPosition(0, 165 - i * 165);
                const component = cell.getComponent(slots_cell);
                component.setBlur(false);
                component.setCellValue(strips[c][i]);
                cell.active = true;
            }
            reel.bindPicker();
        });
        // HTML封面在这批牌真正完成首帧绘制后再关闭。
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
                label.string = this.balance;
            }
            if (label.node.name === 'lab_bet') {
                label.string = this.betAmount;
            }
            if (label.node.name === 'lab_win') {
                label.string = this.winAmount;
            }
        }
    }

    /** 登录后恢复最后已结算的盘面和累计赢分，再展示消除并请求下一轮。 */
    private async connect() {
        this.state = 1;
        this.notifyFlowChanged();
        try {
            const login = await this.api.login();
            this.balance = login.balance;
            const config = await this.api.config();
            this.betOptions = config.betOptions;
            this.betAmount = config.defaultBet;
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
                this.winAmount = state.lastFrame.totalWinAmount;
                this.click_stop = false;
                this.labels();
                await this.play({ ...state.lastFrame, balance: state.balance }, true);
            } else if (state.hasNext) {
                this.betAmount = state.betAmount || this.betAmount;
                await this.play(await this.api.spin(this.betAmount));
            } else {
                this.finish();
            }
        } catch (e) {
            this.fail(e);
        }
    }

    /** HTML记录页复用当前会话，不参与游戏结算或修改盘面。 */
    openPaytable() {
        if (typeof document === 'undefined') return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        this.historyPage?.close(); this.rulesPage?.close();
        if (!this.paytablePage) this.paytablePage = new PaytablePage(canvas);
        this.paytablePage.open();
    }

    openRules() {
        if (typeof document === 'undefined') return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        this.historyPage?.close();
        this.paytablePage?.close();
        if (!this.rulesPage) this.rulesPage = new RulesPage(canvas);
        this.rulesPage.open();
    }

    openHistory() {
        if (!this.ready || typeof document === 'undefined') return;
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        if (!this.historyPage)
            this.historyPage = new HistoryPage(
                this.api,
                canvas,
                () => gameBounds(canvas.getBoundingClientRect()),
                loadHistoryArt,
            );
        this.rulesPage?.close();
        this.paytablePage?.close();
        this.historyPage.open();
    }

    /** 总流程忙碌时忽略重复点击，网络异常则保留请求用于重试。 */
    async spin() {
        if (!this.alive || this.state !== 0) {
            return;
        }
        if (!this.ready) {
            void this.connect();
            return;
        }
        this.state = 1;
        this.click_stop = false;
        this.error = '';
        this.hideAwardShade();
        if (!this.activeBet) this.effects?.resetMultiplier();
        this.notifyFlowChanged();
        this.reels.forEach((r) => r.startRoll());
        try {
            await this.play(await this.api.spin(this.betAmount));
        } catch (e) {
            this.fail(e);
        }
    }

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
    private async playColumnAwards(frame: Frame, winning: Set<number>) {
        await Promise.all(
            this.reels.map(async (reel, column) => {
                const rows = frame.board[column].flatMap((cell, row) =>
                    winning.has(cell.id) ? [row] : [],
                );
                if (!rows.length) return;
                if (column > 0) await this.pause(column * AWARD_COLUMN_DELAY);
                if (!this.alive) return;
                reel.award(
                    rows,
                    frame.board[column].flatMap((cell, row) =>
                        frame.transformedIds.includes(cell.id) ? [row] : [],
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

    /** 响应尚未到达时只记录停止意图，不能把客户端随机盘面当成结果。 */
    stop() {
        if (this.state === 0) {
            return;
        }
        // 补落（含列间等待和落地回弹）不接受 Stop，也不记录停止意图。
        if (this.reels.some((reel) => reel.state === 5)) return;
        if (this.effects?.dismiss()) return;
        this.anticipation?.clear();
        this.click_stop = true;
        if (this.state === 2) {
            this.stopReelsWithEffects();
        }
    }

    /** 手动停止不会经过 tick 的停轴状态转换，需要在落位后主动补上演出。 */
    private stopReelsWithEffects() {
        // 门槛统一取最后一列，满足前任何列都不能响应这次手动停止。
        const last = this.reels[this.reels.length - 1];
        if (last?.canManualStop === false) return;
        this.reels.forEach((reel) => {
            if (reel.state === 0 || reel.state === 5) return;
            reel.stop();
            reel.playLandingEffects?.();
            if (
                this.current?.board[reel.index]
                    ?.slice(this.current.previewRows ?? 1)
                    .some((cell) => cell.symbolId === 11)
            ) {
                this.effects?.sound('symbolScatter');
            }
        });
    }

    changeBet(delta: number) {
        if (this.state !== 0 || this.activeBet || !this.ready) {
            return;
        }
        const i = this.betOptions.indexOf(this.betAmount);
        this.betAmount =
            this.betOptions[Math.max(0, Math.min(this.betOptions.length - 1, i + delta))] ||
            this.betAmount;
        this.labels();
    }

    /** 服务端决定中奖和余额；这里只安排停轴、消除及下一轮的展示顺序。 */
    private async play(frame: Frame, restore = false) {
        let first = true;
        while (this.alive) {
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
            this.current = frame;
            this.boards = strips;
            this.activeBet = frame.nextAction !== 'complete';
            if (restore && first) {
                this.anticipation?.clear();
                this.reels.forEach((reel, c) => reel.showBoard(strips[c]));
                this.state = 2;
            } else if (cascade) {
                this.anticipation?.clear();
                const sources = gravitySources(previous.board, frame.board);
                const delays = cascadeDropDelays(sources, DROP_COLUMN_DELAY);
                this.reels.forEach((reel, c) => {
                    const seen = new Set(
                        previous.board[c].slice(previous.previewRows ?? 1).map((cell) => cell.id),
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
                // 新一局（包含免费局）在转轴开始时切换倍率，续传则使用实际档位。
                this.effects?.multiplier(
                    frame.cascadeFactors,
                    frame.cascadeIndex ?? 0,
                    frame.mode === 'free',
                );
                if (!this.reels.some((r) => r.state !== 0)) {
                    this.reels.forEach((r) => r.startRoll());
                }
                this.reels.forEach((r, c) => r.stopRoll(strips[c]));
                this.anticipation?.begin(
                    anticipationColumns(
                        frame.board,
                        frame.mode === 'free',
                        this.fast || this.click_stop,
                        frame.previewRows ?? 1,
                    ),
                );
                this.state = 2;
                if (this.click_stop) {
                    this.stopReelsWithEffects();
                }
            }
            await this.until(() => this.reels.every((r) => r.state === 0));
            if (!this.alive) {
                return;
            }
            this.anticipation?.clear();
            this.effects?.multiplier(
                frame.cascadeFactors,
                frame.cascadeIndex ?? 0,
                frame.mode === 'free',
            );
            this.state = 3;
            this.balance = frame.balance;
            this.betAmount = frame.betAmount;
            this.winAmount = frame.totalWinAmount;
            this.labels();
            this.notifyFlowChanged();
            const winning = new Set(frame.wins.flatMap((w) => w.cellIds));
            if (winning.size) {
                await this.pause(ROUND_TRANSITION_DELAY);
                if (!this.alive) return;
                this.showAwardShade();
                this.effects?.sound('symbolShrink');
                await this.playColumnAwards(frame, winning);
                await this.until(() => this.reels.every((reel) => !reel.isAwardPlaying));
                this.hideAwardShade();
                await this.pause(ROUND_TRANSITION_DELAY);
                if (!this.alive) return;
                this.effects?.sound('symbolCollapse');
            } else {
                await this.pause(0.2);
            }
            if (!this.alive) {
                return;
            }
            // 已结束的下注只恢复静态结果，不在每次刷新时重播大奖或免费结算弹窗。
            if (restore && first && frame.nextAction === 'complete') {
                this.finish();
                return;
            }
            if (!winning.size && frame.spinWinAmount) {
                const type = bigWinType(frame.spinWinAmount, frame.betAmount);
                if (type > 0) await this.effects?.bigWin(frame.spinWinAmount, type, frame.betAmount);
            }
            if (frame.nextAction === 'complete') {
                if (frame.mode === 'free') await this.effects?.freeEnd(frame.totalWinAmount);
                this.finish();
                return;
            }
            if (frame.nextAction === 'start_free') {
                if (frame.mode === 'base') await this.effects?.intro(frame.freeRemaining);
                else if (frame.triggeredFree)
                    await this.effects?.retrigger(frame.awardedFreeSpins ?? frame.freeRemaining);
            }
            if (!this.alive) return;
            this.notifyFlowChanged();
            frame = await this.api.spin(frame.betAmount);
            first = false;
        }
    }

    // 使用引擎 update 计时，暂停或销毁场景时不会遗留独立的 JS 定时器。
    private pause(seconds: number) {
        return new Promise<void>((resolve) => this.timers.push({ left: seconds, resolve }));
    }

    private async until(test: () => boolean) {
        while (this.alive && !test()) {
            await this.pause(0.016);
        }
    }

    private finish() {
        this.anticipation?.clear();
        this.state = 0;
        this.click_stop = false;
        this.notifyFlowChanged();
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
        this.reels.forEach((r) => r.stop());
        this.state = 0;
        this.error = e instanceof Error ? e.message : String(e);
        this.notifyFlowChanged();
    }

    protected onDestroy() {
        this.historyPage?.destroy();
        this.rulesPage?.destroy();
        this.paytablePage?.destroy();
        this.performanceCapture?.destroy();
        this.alive = false;
        for (const timer of this.timers) {
            timer.resolve();
        }
        this.timers = [];
    }

    /** 大帧拆成小步推进转轴，避免低帧率时一次跨过多个回卷边界。 */
    update(dt: number) {
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
                            ?.slice(this.current.previewRows ?? 1)
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
