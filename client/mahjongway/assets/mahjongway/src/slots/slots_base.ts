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
    private failureDialog: HTMLDivElement = null;
    private retryBanner: HTMLDivElement = null;
    private retryTimer = 0;
    private betOptionsOverlay: HTMLDivElement = null;
    private autoSpinPage: AutoSpinPage = null;
    private autoSpinsRemaining = 0;
    private timers: Array<{
        left: number;
        resolve: () => void;
    }> = [];

    private loadFastMode() {
        try { return localStorage.getItem('aislots-fast-mode') === 'true'; } catch { return false; }
    }

    setFastMode(value: boolean) {
        this.fast = value;
        try { localStorage.setItem('aislots-fast-mode', String(value)); } catch {}
    }

    /** 先建立连接和特效资源，收到状态前不创建任何 cell。 */
    protected start() {
        if (typeof window !== 'undefined') {
            window.addEventListener('aislots-retry', this.showRetryBanner);
            window.addEventListener('aislots-retry-end', this.hideRetryBanner);
        }
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
                label.string = formatMoney(this.balance);
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
        if (!this.rulesPage) this.rulesPage = new RulesPage(canvas, undefined, () => ({
            bets: [...new Set(this.betChoices.map(choice => choice.bet))],
            levels: [...new Set(this.betChoices.map(choice => choice.level))],
            lineCount: this.lineCount,
        }));
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
    async spin(): Promise<boolean> {
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
        if (!this.activeBet) { this.effects?.resetMultiplier(); this.effects?.spinSound(); }
        this.notifyFlowChanged();
        this.reels.forEach((r) => r.startRoll());
        try {
            await this.play(await this.api.spin(this.bet, this.betLevel));
            return true;
        } catch (e) {
            this.fail(e);
            return false;
        }
    }

    openAutoSpin() {
        if (typeof document === 'undefined' || !this.ready || this.state !== 0) return;
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
        if (this.state !== 0 || count < 1) return;
        this.autoSpinsRemaining = count;
        void this.runAutoSpins();
    }

    private async runAutoSpins() {
        while (this.alive && this.autoSpinsRemaining > 0 && this.state === 0) {
            const balance = Number(this.balance);
            const stake = Number(this.bet) * this.betLevel * this.lineCount;
            if (Number.isFinite(balance) && Number.isFinite(stake) && balance < stake) {
                this.autoSpinsRemaining = 0;
                this.showInsufficientFundsDialog();
                break;
            }
            const completed = await this.spin();
            if (!completed) {
                this.autoSpinsRemaining = 0;
                break;
            }
            if (this.state !== 0) break;
            this.autoSpinsRemaining--;
            if (this.autoSpinsRemaining > 0) await this.pause(0.25);
        }
        if (this.state === 0) this.autoSpinsRemaining = 0;
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
        this.autoSpinsRemaining = 0;
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
        const i = this.betChoices.findIndex(choice => choice.bet === this.bet && choice.level === this.betLevel);
        const choice = this.betChoices[Math.max(0, Math.min(this.betChoices.length - 1, i + delta))];
        if (choice) { this.bet = choice.bet; this.betLevel = choice.level; }
        this.betAmount = this.totalBet(this.bet, this.betLevel);
        this.labels();
    }

    openBetOptions() {
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
        const values = [...new Set(choices.map(item => item.bet))];
        const levels = [...new Set(choices.map(item => item.level))];
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
            style.textContent += '.bet-wheel-column,.bet-wheel-total{height:160px;overflow:auto;scrollbar-width:none;scroll-snap-type:y mandatory;scroll-padding:64px 0;padding:64px 0}.bet-wheel-column button,.bet-wheel-total button{display:block;width:100%;height:32px;scroll-snap-align:center;border:0;background:transparent;color:#777782;font:inherit;font-size:16px;line-height:32px;white-space:nowrap}.bet-wheel-column button.active,.bet-wheel-total button.active{color:#fff}.bet-wheel-column::-webkit-scrollbar,.bet-wheel-total::-webkit-scrollbar{display:none}.bet-selector-bg{top:96px;height:32px}.bet-wheel-lines{height:160px;display:flex;align-items:center;justify-content:center;transform:none}.bet-wheel-lines span{display:block;height:32px;line-height:32px}.bet-wheel-total{color:#b47850;font-weight:400;transform:none}.bet-wheel-total button{color:#777782}.bet-wheel-total button.active{color:#fff}';
            document.head.append(style);
        }
        document.body.append(root); this.betOptionsOverlay = root; requestAnimationFrame(() => root.classList.add('visible'));
    }

    private totalBet(bet: string, level: number) {
        try { return (BigInt(bet) * BigInt(level) * BigInt(this.lineCount)).toString(); }
        catch { return '0'; }
    }

    private restoreBetChoice(total: string) {
        const choice = this.betChoices.find(item => this.totalBet(item.bet, item.level) === total);
        if (choice) { this.bet = choice.bet; this.betLevel = choice.level; }
    }

    /** 服务端决定中奖和余额；这里只安排停轴、消除及下一轮的展示顺序。 */
    reelStopped(quick: boolean) { this.effects?.reelStopped(quick); }

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
            this.effects?.setAudioMode(frame.mode === 'free');
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
                    this.effects?.spinSound();
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
            if (winning.size) {
                await this.pause(ROUND_TRANSITION_DELAY);
                if (!this.alive) return;
                this.showAwardShade();
                this.effects?.awardSound(frame.wins.map(win => win.symbolId), frame.transformedIds.length > 0);
                await this.playColumnAwards(frame, winning);
                await this.until(() => this.reels.every((reel) => !reel.isAwardPlaying));
                this.hideAwardShade();
                await this.pause(ROUND_TRANSITION_DELAY);
                if (!this.alive) return;

            } else {
                await this.pause(0.2);
            }
            if (!this.alive) {
                return;
            }
            await this.rollSettlement(frame);
            if (!this.alive) return;
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
                if (frame.mode === 'free') {
                    await this.effects?.freeEnd(frame.totalWinAmount);
                    this.effects?.setAudioMode(false);
                }
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
                frame = await this.api.spin(this.bet, this.betLevel);
            first = false;
        }
    }

    /** 中奖阶段结束后，将本轮余额和累计赢分平滑滚动到服务端结果。 */
    private async rollSettlement(frame: Frame) {
        const startBalance = this.balance;
        const startWin = this.winAmount;
        const endBalance = frame.balance;
        const endWin = frame.totalWinAmount;
        const steps = 8;
        for (let i = 1; i <= steps && this.alive; i++) {
            this.balance = interpolateAmount(startBalance, endBalance, i, steps);
            this.winAmount = interpolateAmount(startWin, endWin, i, steps);
            this.labels();
            await this.pause(0.02);
        }
        this.balance = endBalance;
        this.winAmount = endWin;
        this.labels();
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
            this.connect();
        });
        content.appendChild(button);
        root.appendChild(content);
        const game = document.getElementById('GameDiv');
        if (!game) return;
        if (getComputedStyle(game).position === 'static') game.style.position = 'relative';
        game.appendChild(root);
        this.failureDialog = root;
    }

    private showInsufficientFundsDialog() {
        if (typeof document === 'undefined' || this.failureDialog) return;
        const root = document.createElement('div');
        root.style.cssText = 'position:absolute;inset:0;z-index:10000;container-type:size;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:#fff;';
        const content = document.createElement('div');
        content.style.cssText = 'width:84%;background:rgba(40,40,52,.96);border-radius:4%;padding:7% 7% 5%;text-align:center;overflow:hidden;';
        content.innerHTML = '<div style="font-size:clamp(18px,6cqw,30px);font-weight:500;margin-bottom:7%;">余额不足</div>' +
            '<div style="line-height:1.55;font-size:clamp(12px,3.8cqw,19px);color:#bdbbc3;">请充值后再试。</div>';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '确定';
        button.style.cssText = 'display:block;width:70%;margin:8% auto 0;border:0;border-radius:2em;background:#c8874f;color:#202124;padding:3.5%;font-size:clamp(13px,4cqw,20px);cursor:pointer;';
        button.addEventListener('click', () => { root.remove(); this.failureDialog = null; });
        content.appendChild(button);
        root.appendChild(content);
        const game = document.getElementById('GameDiv');
        if (!game) return;
        if (getComputedStyle(game).position === 'static') game.style.position = 'relative';
        game.appendChild(root);
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
    return [...result.values()].sort((a, b) => BigInt(a.display) < BigInt(b.display) ? -1 : 1);
}
