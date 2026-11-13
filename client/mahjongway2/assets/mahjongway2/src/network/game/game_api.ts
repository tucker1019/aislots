import { LaunchSession } from './launch_session';
import { historyListResponse, historyReplayResponse } from '../../history/history_response';
import type { HistoryQuery } from '../../history/history_types';
import { HttpClient } from '../http/http_client';
/** 服务端格子 ID 在连续消除中保持稳定，不能拿图标 ID 代替。 */
export interface Cell {
    id: number;
    symbolId: number;
}
/** 一次 spin 已结算的当前轮；后续盘面通过下一次 spin 获取。金额使用整数字符串。 */
export interface Frame {
    bottomSymbols?: number[];
    spinWinAmount?: string;
    cascadeFactors?: string[];
    cascadeIndex?: number;
    triggeredFree?: boolean;
    awardedFreeSpins?: number;
    requestId: string;
    nextRequestId: string;
    betId: string;
    spinIndex: number;
    stepIndex: number;
    mode: 'base' | 'free';
    nextAction: 'continue' | 'start_free' | 'complete';
    board: Cell[][];
    wins: Array<{ symbolId: number; cellIds: number[] }>;
    removedIds: number[];
    transformedIds: number[];
    balance: string;
    betAmount: string;
    winAmount: string;
    totalWinAmount: string;
    freeRemaining: number;
    previewRows?: number;
}
export interface BetConfig {
    betOptions: string[];
    defaultBet: string;
    lineCount: number;
    betLevel: number;
}
export interface Progress {
    lastFrame?: Frame;
    requestId: string;
    balance: string;
    hasNext: boolean;
    betAmount?: string;
}
export type Request = <T>(path: string, body?: object, token?: string) => Promise<T>;
export class GameApi {
    private token = '';
    private launch: LaunchSession;
    private next = '';
    // 超时不代表下注失败：保留同一请求标识和金额，重试时避免重复扣款。
    private pending: { requestId: string; bet: string; betLevel: number } = null;
    private request: Request;
    private route: string;
    constructor(
        base: string,
        private identity = {
            appname: 'test-platform',
            appkey: 'test-app',
            uid: 'test-user',
            gameId: 'AG2',
            test: true,
        },
        request?: Request,
    ) {
        this.launch = new LaunchSession(base, identity.gameId);
        this.route = '/games/' + encodeURIComponent(identity.gameId);
        const client = new HttpClient({
            baseURL: base.replace(/\/$/, '') + '/api/v1',
            timeout: 10000,
        });
        this.request =
            request ||
            (async <T>(path: string, body?: object, token?: string) => {
                const config = { headers: token ? { Authorization: 'Bearer ' + token } : {} };
                const once = path.includes('/bet-records');
                const requestConfig = { ...config, ...(once ? { retry: false } : {}) };
                const res = body
                    ? await client.post<any>(path, body, requestConfig)
                    : await client.get<any>(path, requestConfig);
                if (res.data?.code !== 'OK') throw new Error(res.data?.message || '服务端响应无效');
                return res.data.data as T;
            });
    }
    async login() {
        const launch = this.launch.request();
        if (launch) {
            const data = await this.request<{ accessToken: string; balance: string }>('/login', { ...launch, gameId: this.identity.gameId });
            if (typeof data.accessToken !== 'string' || !data.accessToken) throw new Error('游戏登录响应无效');
            this.token = data.accessToken; this.launch.save(this.token); return data;
        }
        const saved = this.launch.read();
        if (saved.live) {
            if (!saved.token || typeof saved.token !== 'string') throw new Error('游戏会话已失效，请从大厅重新进入');
            this.token = saved.token;
            try { const state = await this.state(); this.launch.clearTicketURL(); return { accessToken: this.token, balance: state.balance }; }
            catch (error) {
                if ((error as { status?: number }).status === 401) {
                    this.token = ''; this.launch.expire(); throw new Error('游戏会话已失效，请从大厅重新进入');
                }
                throw error;
            }
        }
        const data = await this.request<{ accessToken: string; balance: string }>(
            '/login',
            this.identity,
        );
        this.token = data.accessToken;
        return data;
    }
    config() {
        return this.request<BetConfig>(this.route + '/bets', undefined, this.token);
    }
    /** 同时读取最后已结算的展示快照和下一轮标识，查询不会推进结算。 */
    async state() {
        const data = await this.request<Progress>(this.route + '/state', undefined, this.token);
        this.next = data.requestId;
        return data;
    }
    /** 历史只复用当前登录态发起GET，不调用state/spin或修改幂等请求标识。 */
    async historyRecords(query: HistoryQuery) {
        const params = new URLSearchParams({ from: query.from, to: query.to, limit: '20' });
        if (query.cursor) params.set('cursor', query.cursor);
        return historyListResponse(await this.request<unknown>(
            this.route + '/bet-records?' + params,
            undefined,
            this.token,
        ));
    }
    async historyReplay(betId: string, cursor?: string) {
        const params = new URLSearchParams({ limit: '100' });
        if (cursor) params.set('cursor', cursor);
        return historyReplayResponse(await this.request<unknown>(
            this.route + '/bet-records/' + encodeURIComponent(betId) + '/replay?' + params,
            undefined,
            this.token,
        ));
    }

    async createReplayShare(betId: string) {
        return this.request<{ betId: string; shareToken: string }>(
            this.route + '/bet-records/' + encodeURIComponent(betId) + '/share', {}, this.token);
    }
    async sharedReplay(betId: string, share: string, cursor?: string) {
        const params = new URLSearchParams({ share, limit: '100' });
        if (cursor) params.set('cursor', cursor);
        return historyReplayResponse(await this.request<unknown>(
            this.route + '/shared-replays/' + encodeURIComponent(betId) + '?' + params));
    }

    /** 普通旋转、连续消除和免费旋转共用同一个接口。 */
    async spin(bet: string, betLevel: number) {
        if (!this.next && !this.pending) await this.state();
        this.pending = this.pending || { requestId: this.next, bet, betLevel };
        let frame: Frame;
        try {
            frame = await this.request<Frame>(this.route + '/spin', this.pending, this.token);
        } catch (error) {
            // Re-authentication does not replace the outstanding server nonce.
            // 共享测试用户可能被其他窗口推进；同步后让用户明确重试，不自动另开下注。
            if ((error as any)?.status === 409) {
                this.pending = null;
                const progress = await this.state();
                throw Object.assign(new Error('游戏状态已在其他窗口更新，已同步，请重新点击旋转'), {
                    progress,
                });
            }
            if ((error as any)?.status === 401) {
                await this.login();
                frame = await this.request<Frame>(this.route + '/spin', this.pending, this.token);
            } else throw error;
        }
        if (!frame.nextRequestId) throw new Error('服务端未返回下次请求标识');
        this.next = frame.nextRequestId;
        this.pending = null;
        return frame;
    }
}
