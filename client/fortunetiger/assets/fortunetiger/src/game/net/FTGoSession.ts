import { LaunchSession, resolveApiBase } from './launch_session';
import { GoFrame, toOriginalAward } from './FTResultAdapter';

const game = '/games/AG4';
type Receipt = GoFrame & { requestId: string; nextRequestId: string };
type Status = { requestId: string; balance: number; hasNext: boolean; lastFrame?: GoFrame };
type Policy = { lineCount: number; amountScale: number; betOptions: string[]; betLevel: number; defaultBet: string; currency: string };

export class FTGoSession {
    private base = resolveApiBase(location.href);
    private launch = new LaunchSession(this.base, 'AG4');
    private token = '';
    private next = '';
    private receipt: Receipt;
    private plan: GoFrame[] = [];
    private stake: { bet: string; betLevel: number };
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
                    if (response.status < 500) throw Object.assign(new Error(envelope?.message || 'Request failed'), { definitive: true });
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
        const ticket = this.launch.request();
        let uid = 'AG4';
        if (ticket) {
            const login = await this.request<{accessToken:string;player?:{subject?:{uid?:string}}}>('/login', {...ticket, gameId:'AG4'}, true);
            if (!login.accessToken) throw new Error('Invalid game session');
            uid = login.player?.subject?.uid || uid;
            sessionStorage.setItem('aislots-live:AG4:uid', uid);
            this.launch.save(login.accessToken);
        }
        this.token = this.launch.read().token || '';
        if (!this.token) throw new Error('Please enter the game from the lobby.');
        this.launch.clearTicketURL();
        const [policy, state] = await Promise.all([this.request<Policy>(game + '/bets'), this.request<Status>(game + '/state')]);
        if (policy.lineCount !== 5 || policy.amountScale !== 2 || !policy.betOptions.length || !state.requestId ||
            !Number.isInteger(policy.betLevel) || policy.betLevel < 1 || !Number.isSafeInteger(state.balance)) throw new Error('Invalid AG4 configuration');
        this.next = state.requestId;
        return { policy, state, uid: sessionStorage.getItem('aislots-live:AG4:uid') || uid };
    }

    async readReplay(betId: string, share?: string) {
        const route = share ? '/shared-replays/' : '/bet-records/';
        if (!share) this.token = this.launch.read().token || '';
        const data = await this.request<{frames: GoFrame[];startBoard?:GoFrame['board'];nextCursor?:string}>(
            game + route + encodeURIComponent(betId) + (share ? '?share=' + encodeURIComponent(share) : '/replay'), undefined, !!share);
        if (data.nextCursor || !data.frames.length || data.frames.some(f => f.betId !== betId)) throw new Error('Invalid AG4 replay');
        this.replay = true;
        this.plan = data.frames;
        return { startBoard: data.startBoard, betId, count: this.plan.length, betAmount: Number(this.plan[0].betAmount),
            award: toOriginalAward(this.plan, 0, 0) };
    }

    async shareReplay(betId: string) {
        return this.request<{shareToken:string}>(game + '/bet-records/' + encodeURIComponent(betId) + '/share', {});
    }

    async history(from: string, to: string, cursor?: string) {
        const query = new URLSearchParams({from, to, limit:'20'});
        if (cursor) query.set('cursor', cursor);
        return this.request<{items:Array<{betId:string;betAmount:string;totalWinAmount:string;createdAt:string;status:string}>;nextCursor?:string}>(game + '/bet-records?' + query);
    }

    private async spin(): Promise<Receipt> {
        const requestId = this.next;
        const frame = await this.request<Receipt>(game + '/spin', { ...this.stake, requestId });
        if (frame.requestId !== requestId || !frame.nextRequestId || frame.nextRequestId === requestId) throw new Error('Invalid spin receipt');
        this.next = frame.nextRequestId;
        this.receipt = frame;
        return frame;
    }

    private async loadPlan(betId: string) {
        this.plan = await this.request<GoFrame[]>(game + '/presentation/' + encodeURIComponent(betId));
        if (!this.plan.length || this.plan.some(f => f.betId !== betId)) throw new Error('Invalid round plan');
    }

    async begin(bet: number, level: number, index: number) {
        this.stake = {bet:String(bet), betLevel:level};
        const frame = await this.spin();
        if (frame.stepIndex !== 1) throw new Error('Unexpected pending round');
        this.plan = [frame];
        if (frame.nextAction === 'continue') await this.loadPlan(frame.betId);
        return { award: toOriginalAward(this.plan, index, level - 1), balance: Number(frame.balance) };
    }

    async restore(state: Status, policy: Policy) {
        const frame = state.lastFrame;
        if (!state.hasNext || !frame) throw new Error('Missing pending round');
        const amount = Number(frame.betAmount);
        const index = policy.betOptions.findIndex(bet => {
            const level = amount / (Number(bet) * 5);
            return Number.isInteger(level) && level > 0 && level <= policy.betLevel;
        });
        if (index < 0) throw new Error('Saved wager no longer configured');
        const level = amount / (Number(policy.betOptions[index]) * 5);
        this.stake = {bet:policy.betOptions[index], betLevel:level};
        this.receipt = {...frame, requestId:'', nextRequestId:this.next};
        await this.loadPlan(frame.betId);
        return { award: toOriginalAward(this.plan, index, level - 1), balance: state.balance, index, level };
    }

    async afterStop(index: number) {
        if (this.replay || !this.receipt || index <= this.receipt.stepIndex) return;
        if (index !== this.receipt.stepIndex + 1 || this.receipt.nextAction !== 'continue') throw new Error('Invalid respin step');
        const expected = this.plan[index - 1];
        const frame = await this.spin();
        if (!expected || frame.betId !== expected.betId || frame.stepIndex !== expected.stepIndex ||
            frame.nextAction !== expected.nextAction || Number(frame.totalWinAmount) !== Number(expected.totalWinAmount) ||
            JSON.stringify(frame.board) !== JSON.stringify(expected.board)) throw new Error('Respin differs from saved plan');
    }

    get balance(): number | undefined {
        return this.replay || !this.receipt ? undefined : Number(this.receipt.balance);
    }
}

export const goSession = typeof location !== 'undefined' ? new FTGoSession() : null;
