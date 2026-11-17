import { LaunchSession, resolveApiBase } from './launch_session';
import { GoFrame, toOriginalAward } from './FLResultAdapter';
import { historyListResponse, historyReplayResponse } from '../history/history_response';
import type { HistoryQuery, HistoryReplay } from '../history/history_types';
import { loadAg4Replay } from '../history/replay_data';

const game = '/games/AG9';
type Receipt = GoFrame & { requestId: string; nextRequestId: string };
type Status = { requestId: string; balance: number; hasNext: boolean; lastFrame?: GoFrame };
type Policy = { lineCount: number; amountScale: number; betOptions: string[]; betLevel: number; defaultBet: string; currency: string };

export class FLGoSession {
    private base = resolveApiBase(location.href);
    private launch = new LaunchSession(this.base, 'AG9');
    private token = '';
    private next = '';
    private receipt: Receipt;
    private received: GoFrame[] = [];
    private stake: { bet: string; betLevel: number };
    private connectPromise?: Promise<{ policy: Policy; state: Status; uid: string }>;
    replay = false;
    entry?: { live?: { policy: Policy; state: Status; uid: string }; replay?: {
        startBoard?: GoFrame['board']; betId: string; count: number; betAmount: number; award: ReturnType<typeof toOriginalAward>;
    } };

    private async request<T>(path: string, body?: object, publicCall = false): Promise<T> {
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await fetch(this.base + '/api/v1' + path, {
                    method: body ? 'POST' : 'GET',
                    headers: { ...(body ? {'Content-Type':'application/json'} : {}),
                        ...(!publicCall ? {Authorization:'Bearer ' + this.token} : {}) },
                    body: body ? JSON.stringify(body) : undefined,
                    signal: AbortSignal.timeout(10000),
                });
                const envelope = await response.json().catch(() => null);
                if (!response.ok || envelope?.code !== 'OK') {
                    if (response.status < 500) throw Object.assign(new Error(envelope?.message || 'Request failed'), { definitive: true, status: response.status });
                    throw new Error(envelope?.message || 'Server unavailable');
                }
                return envelope.data as T;
            } catch (error) {
                if (attempt === 2 || error.definitive) throw error;
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    }

    async connect() {
        if (this.entry?.live) return this.entry.live;
        if (this.connectPromise) return this.connectPromise;
        this.connectPromise = this.connectImpl();
        try {
            return await this.connectPromise;
        } finally {
            this.connectPromise = undefined;
        }
    }

    private async connectImpl() {
        const ticket = this.launch.request();
        let uid = 'AG9';
        if (ticket) {
            const login = await this.request<{accessToken:string;player?:{subject?:{uid?:string}}}>('/login', {...ticket, gameId:'AG9'}, true);
            if (!login.accessToken) throw new Error('Invalid game session');
            uid = login.player?.subject?.uid || uid;
            sessionStorage.setItem('aislots-live:AG9:uid', uid);
            this.launch.save(login.accessToken);
        }
        this.token = this.launch.read().token || '';
        if (!this.token) throw new Error('Please enter the game from the lobby.');
        this.launch.clearTicketURL();
        const [policy, state] = await Promise.all([this.request<Policy>(game + '/bets'), this.request<Status>(game + '/state')]);
        if (policy.lineCount !== 5 || policy.amountScale !== 2 || !policy.betOptions.length || !state.requestId ||
            !Number.isInteger(policy.betLevel) || policy.betLevel < 1 || !Number.isSafeInteger(state.balance)) throw new Error('Invalid AG9 configuration');
        this.next = state.requestId;
        return { policy, state, uid: sessionStorage.getItem('aislots-live:AG9:uid') || uid };
    }

    async readReplay(betId: string, share?: string) {
        if (!share) this.token = this.launch.read().token || '';
        const data = await loadAg4Replay({historyReplay: (id, cursor) => this.historyReplay(id, cursor, share)}, betId);
        return this.prepareReplay(data);
    }

    prepareReplay(data: HistoryReplay) {
        if (data.frames[0]?.stepIndex !== 1 || data.frames[data.frames.length - 1]?.nextAction !== 'complete')
            throw new Error('Incomplete AG9 replay');
        const award = toOriginalAward(data.frames);
        this.replay = true;
        return { startBoard: data.startBoard, betId: data.bet.betId, count: data.frames.length,
            betAmount: Number(data.frames[0].betAmount), award };
    }

    async shareReplay(betId: string) {
        return this.request<{shareToken:string}>(game + '/bet-records/' + encodeURIComponent(betId) + '/share', {});
    }

    async historyRecords({from, to, cursor}: HistoryQuery) {
        const query = new URLSearchParams({from, to, limit:'20'});
        if (cursor) query.set('cursor', cursor);
        return historyListResponse(await this.request<unknown>(game + '/bet-records?' + query));
    }

    async historyReplay(betId: string, cursor?: string, share?: string) {
        const id = encodeURIComponent(betId);
        const path = share ? '/shared-replays/' + id : '/bet-records/' + id + '/replay';
        const query = new URLSearchParams({limit:'100'});
        if (cursor) query.set('cursor', cursor);
        if (share) query.set('share', share);
        return historyReplayResponse(await this.request<unknown>(game + path + '?' + query, undefined, !!share));
    }

    private async spin(previous?: GoFrame): Promise<Receipt> {
        const requestId = this.next;
        const frame = await this.request<Receipt>(game + '/spin', { ...this.stake, requestId });
        if (frame.requestId !== requestId || !frame.nextRequestId || frame.nextRequestId === requestId ||
            frame.stepIndex !== (previous ? previous.stepIndex + 1 : 1) ||
            (previous && (frame.betId !== previous.betId || frame.mode !== previous.mode ||
                frame.gameData?.targetSymbolId !== previous.gameData?.targetSymbolId))) {
            throw new Error('Invalid AG9 spin receipt');
        }
        this.next = frame.nextRequestId;
        this.receipt = frame;
        return frame;
    }

    async begin(bet: number, level: number) {
        this.stake = {bet:String(bet), betLevel:level};
        const frame = await this.spin();
        this.received = [frame];
        return { award: toOriginalAward(this.received),
            balance: frame.nextAction === 'continue' ? Number(frame.balance) : undefined };
    }

    restore(state: Status, policy: Policy) {
        const frame = state.lastFrame;
        if (!state.hasNext || !frame || frame.mode !== 'respin' || frame.nextAction !== 'continue')
            throw new Error('Missing pending respin');
        const amount = Number(frame.betAmount);
        const index = policy.betOptions.findIndex(bet => {
            const level = amount / (Number(bet) * 5);
            return Number.isInteger(level) && level > 0 && level <= policy.betLevel;
        });
        if (index < 0) throw new Error('Saved wager no longer configured');
        const level = amount / (Number(policy.betOptions[index]) * 5);
        this.stake = {bet:policy.betOptions[index], betLevel:level};
        this.receipt = {...frame, requestId:'', nextRequestId:this.next};
        this.received = [frame];
        return { award: toOriginalAward(this.received), balance: state.balance, index, level };
    }

    get hasNextRespin() { return this.receipt?.mode === 'respin' && this.receipt.nextAction === 'continue'; }

    async nextRespin() {
        if (this.replay || !this.hasNextRespin) throw new Error('No pending AG9 respin');
        const frame = await this.spin(this.receipt);
        this.received.push(frame);
        return toOriginalAward(this.received);
    }

    get balance(): number | undefined {
        return this.replay || !this.receipt ? undefined : Number(this.receipt.balance);
    }

    expireLaunch() {
        this.launch.expire();
        this.launch.clearTicketURL();
        this.token = '';
    }
}

export const goSession = typeof location !== 'undefined' ? new FLGoSession() : null;
