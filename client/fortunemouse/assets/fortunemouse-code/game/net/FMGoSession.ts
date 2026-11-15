import type { HistoryQuery, HistoryReplay } from '../history/history_types';
import { historyListResponse, historyReplayResponse } from '../history/history_response';
import { receiveNativeReplay } from '../history/native_replay_bridge';
import { replayShareURL } from '../history/replay_share';
import { LaunchSession, resolveApiBase } from './launch_session';
import { Frame, boardToIcons, toOriginalSpin } from './FMResultAdapter';

const game = '/games/AG6';
export type Stake = {bet: string; betLevel: number};
export type Policy = {lineCount: number; amountScale: number; betOptions: string[]; betLevel: number; defaultBet: string; currency: string};
type Status = {requestId: string; balance: number; hasNext: boolean; lastFrame?: Frame};
export type Replay = HistoryReplay;

export class FMGoSession {
    private base = resolveApiBase(location.href);
    private launch = new LaunchSession(this.base, 'AG6');
    private token = '';
    private next = '';
    private stake: Stake;
    private pending?: Stake & {requestId: string};
    private last?: Frame;
    private busy = false;
    private policy: Policy;
    entry?: {policy: Policy; state?: Status; replay?: Replay};
    get pendingStake(): Stake | undefined { return this.pending; }

    private async request<T>(path: string, body?: object, publicCall = false): Promise<T> {
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await fetch(this.base + '/api/v1' + path, {
                    method: body ? 'POST' : 'GET',
                    headers: {...(body ? {'Content-Type': 'application/json'} : {}),
                        ...(!publicCall ? {Authorization: 'Bearer ' + this.token} : {})},
                    body: body ? JSON.stringify(body) : undefined,
                    signal: AbortSignal.timeout(10000),
                });
                const envelope = await response.json().catch(() => null);
                if (!response.ok || envelope?.code !== 'OK') {
                    throw Object.assign(new Error(envelope?.message || 'Request failed'), {
                        status: response.status, definitive: response.status >= 400 && response.status < 500,
                    });
                }
                return envelope.data as T;
            } catch (error) {
                if (attempt === 2 || error.definitive) throw error;
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    }

    async connect() {
        const params = new URLSearchParams(location.search);
        const replayId = params.get('replay');
        const share = params.get('share');
        const native = params.get('nativeReplay');
        if (native || replayId) {
            this.token = share || native ? '' : this.launch.read().token || '';
            const replay = native ? this.validateReplay(await receiveNativeReplay(native)) : await this.readReplay(replayId, share);
            const unit = String(replay.frames[0].betAmount / 5);
            return this.entry = {replay, policy: {lineCount: 5, amountScale: replay.amountScale,
                betOptions: [unit], betLevel: 1, defaultBet: unit, currency: ''}};
        }
        const ticket = this.launch.request();
        if (ticket) {
            const login = await this.request<{accessToken: string}>('/login', {...ticket, gameId:'AG6'}, true);
            this.launch.save(login.accessToken);
        }
        this.token = this.launch.read().token || '';
        if (!this.token && params.get('test') === '1' && ['localhost', '127.0.0.1'].includes(location.hostname) &&
            ['localhost', '127.0.0.1'].includes(new URL(this.base).hostname)) {
            const login = await this.request<{accessToken: string}>('/login', {
                test: true, appname: 'test-platform', appkey: 'test-app', uid: 'test-user', gameId: 'AG6',
            }, true);
            this.token = login.accessToken;
        }
        if (!this.token) throw new Error('Please enter the game from the lobby.');
        const [policy, state] = await Promise.all([this.request<Policy>(game + '/bets'), this.request<Status>(game + '/state')]);
        if (policy.lineCount !== 5 || policy.amountScale !== 2 || !policy.betOptions?.length ||
            !policy.betOptions.every(bet => /^\d+$/.test(bet) && Number.isSafeInteger(Number(bet)) && Number(bet) > 0) ||
            !Number.isInteger(policy.betLevel) || policy.betLevel < 1 || !state.requestId || !Number.isSafeInteger(state.balance))
            throw new Error('Invalid AG6 configuration');
        if (state.lastFrame) toOriginalSpin(state.lastFrame);
        this.next = state.requestId;
        this.policy = policy;
        const last = state.lastFrame;
        this.last = state.hasNext ? last : undefined;
        if (state.hasNext) {
            if (last?.nextAction !== 'continue') throw new Error('Missing AG6 continuation');
            const saved = this.launch.readStake(last.betId);
            this.stake = saved && Number(saved.bet) * saved.betLevel * policy.lineCount === last.betAmount
                ? saved : this.stakeForAmount(last.betAmount);
        }
        return this.entry = {policy, state};
    }

    stakeForAmount(amount: number): Stake {
        const policy = this.policy;
        const candidates = policy.betOptions.map(bet => ({bet, betLevel: amount / (Number(bet) * policy.lineCount)}))
            .filter(item => Number.isInteger(item.betLevel) && item.betLevel > 0 && item.betLevel <= policy.betLevel)
            .sort((a, b) => a.betLevel - b.betLevel);
        if (!candidates.length) throw new Error('Saved wager no longer configured');
        return candidates[0];
    }

    async spin(stake?: Stake) {
        if (this.busy || this.entry?.replay) throw new Error('Spin unavailable');
        const prior = this.last?.nextAction === 'continue' ? this.last : undefined;
        const wager = prior ? this.stake : stake;
        if (!this.pending && wager) this.pending = {bet: wager.bet, betLevel: wager.betLevel, requestId: this.next};
        const request = this.pending;
        if (!request?.bet || !request.requestId) throw new Error('Missing AG6 request');
        this.busy = true;
        try {
            const frame = await this.request<Frame>(game + '/spin', request);
            toOriginalSpin(frame);
            if (frame.requestId !== request.requestId || !frame.nextRequestId || frame.nextRequestId === request.requestId ||
                frame.stepIndex !== (prior ? prior.stepIndex + 1 : 1) ||
                frame.betAmount !== Number(request.bet) * request.betLevel * this.policy.lineCount ||
                (prior && (frame.betId !== prior.betId || frame.mode !== 'respin' || frame.gameData.stageTotal !== prior.gameData.stageTotal ||
                    frame.totalWinAmount !== prior.totalWinAmount + frame.winAmount))) throw new Error('Invalid AG6 receipt');
            this.next = frame.nextRequestId;
            this.last = frame;
            this.stake = {bet: request.bet, betLevel: request.betLevel};
            if (frame.nextAction === 'continue') this.launch.saveStake(frame.betId, this.stake);
            else this.launch.clearStake();
            this.pending = undefined;
            return frame;
        } catch (error) {
            if (error.definitive) this.pending = undefined;
            throw error;
        } finally { this.busy = false; }
    }

    async historyRecords({from, to, cursor}: HistoryQuery) {
        const q = new URLSearchParams({limit: '20', from, to});
        if (cursor) q.set('cursor', cursor);
        const raw = await this.request<unknown>(game + '/bet-records?' + q);
        return historyListResponse(raw);
    }

    async historyReplay(betId: string, cursor?: string, share?: string): Promise<HistoryReplay> {
        const id = encodeURIComponent(betId);
        const path = share ? '/shared-replays/' + id : '/bet-records/' + id + '/replay';
        const q = new URLSearchParams({limit: '100'});
        if (cursor) q.set('cursor', cursor);
        if (share) q.set('share', share);
        return historyReplayResponse(await this.request<unknown>(game + path + '?' + q, undefined, !!share));
    }

    async readReplay(betId: string, share?: string) {
        const seen = new Set<string>();
        let first: Replay, cursor: string;
        do {
            const page = await this.historyReplay(betId, cursor, share);
            if (!first) first = page;
            else first.frames.push(...page.frames);
            cursor = page.nextCursor;
            if (cursor && seen.has(cursor)) throw new Error('Invalid replay cursor');
            if (cursor) seen.add(cursor);
        } while (cursor);
        if (first.bet.betId !== betId) throw new Error('Unexpected AG6 replay');
        return this.validateReplay(first);
    }

    private validateReplay(first: Replay) {
        const betId = first.bet.betId;
        if (first.frames.length < 1 || first.frames.length > 9 ||
            first.frames.some((frame, i) => frame.betId !== betId || frame.stepIndex !== i + 1 || frame.gameData?.stageTotal !== first.frames.length ||
                frame.nextAction !== (i === first.frames.length - 1 ? 'complete' : 'continue')))
            throw new Error('Incomplete AG6 replay');
        if (first.startBoard?.length) boardToIcons(first.startBoard);
        first.frames.forEach(toOriginalSpin);
        return first;
    }

    async shareReplay(betId: string) {
        const data = await this.request<{shareToken:string}>(game + '/bet-records/' + encodeURIComponent(betId) + '/share', {});
        return replayShareURL(location.href, betId, data.shareToken);
    }
}

export const goSession = typeof location !== 'undefined' ? new FMGoSession() : null;
