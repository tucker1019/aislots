import { historyListResponse, historyReplayResponse } from '../history/history_response';
import { HistoryQuery } from '../history/history_types';
import { LaunchSession } from './launch_session';
import { BetConfig, Frame, Progress, Request } from './game_types';
export class ApiError extends Error {
    constructor(message: string, public status: number, public code = '') { super(message); }
}
export class GameApi {
    private token = '';
    private next = '';
    private pending: {
        requestId: string;
        bet: string;
        betLevel: number;
    } | null = null;
    private flight: Promise<Frame> | null = null;
    private launch: LaunchSession;
    private request: Request;
    constructor(base: string, request?: Request) {
        this.launch = new LaunchSession(base, 'AG3');
        this.request = request || (async <T>(path: string, body?: object, token?: string): Promise<T> => {
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), 15000);
            try {
                const response = await fetch(base.replace(/\/$/, '') + '/api/v1' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: abort.signal });
                const result: unknown = await response.json();
                if (!result || typeof result !== 'object')
                    throw new ApiError('Invalid response', response.status);
                const envelope = result as {
                    code?: string;
                    message?: string;
                    data?: T;
                };
                if (!response.ok || envelope.code !== 'OK')
                    throw new ApiError(envelope.message || 'Request failed', response.status, envelope.code);
                return envelope.data;
            }
            finally {
                clearTimeout(timer);
            }
        });
    }
    async login() {
        const ticket = this.launch.request();
        const saved = this.launch.read();
        if (!ticket) {
            if (!saved.token)
                throw new Error('Please enter AG3 from the lobby');
            this.token = saved.token;
            return;
        }
        const result = await this.request<{
            accessToken: string;
        }>('/login', { ...ticket, gameId: 'AG3' });
        if (!result.accessToken)
            throw new Error('Invalid game session');
        this.token = result.accessToken;
        this.launch.save(this.token);
    }
    config() { return this.request<BetConfig>('/games/AG3/bets', undefined, this.token); }
    async state() { if (this.flight)
        throw Error('Round request in progress'); const state = await this.request<Progress>('/games/AG3/state', undefined, this.token); if (!this.pending)
        this.next = state.requestId; return state; }
    spin(bet: number, betLevel = 1): Promise<Frame> {
        if (this.flight)
            return this.flight;
        if (!this.pending) {
            if (!this.next)
                return Promise.reject(Error('Game state is not ready'));
            this.pending = { requestId: this.next, bet: String(bet), betLevel };
        }
        const body = { ...this.pending };
        this.flight = this.request<Frame>('/games/AG3/spin', body, this.token).then(frame => { this.next = frame.nextRequestId; this.pending = null; return frame; }).finally(() => { this.flight = null; });
        return this.flight;
    }
    async historyRecords(query: HistoryQuery) { const params = new URLSearchParams({ from: query.from, to: query.to, limit: '20' }); if (query.cursor)
        params.set('cursor', query.cursor); return historyListResponse(await this.request<unknown>('/games/AG3/bet-records?' + params, undefined, this.token)); }
    async historyReplay(betId: string, cursor?: string) { return historyReplayResponse(await this.request<unknown>('/games/AG3/bet-records/' + encodeURIComponent(betId) + '/replay?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), undefined, this.token)); }
    async sharedReplay(betId: string, share: string, cursor?: string) { return historyReplayResponse(await this.request<unknown>('/games/AG3/shared-replays/' + encodeURIComponent(betId) + '?share=' + encodeURIComponent(share) + '&limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''))); }
    createReplayShare(betId: string) { return this.request<{
        shareToken: string;
    }>('/games/AG3/bet-records/' + encodeURIComponent(betId) + '/share', {}, this.token); }
}
