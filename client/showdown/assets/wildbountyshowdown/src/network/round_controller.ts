import { Frame } from './game_types';
export function describeFrame(frame: Frame): {
    transition: 'cascade' | 'enter-free' | 'retrigger' | 'next-free' | 'end-free' | 'complete';
    remaining: number;
    awarded: number;
} {
    const transition = frame.nextAction === 'continue' ? 'cascade' : frame.nextAction === 'start_free' ? (frame.mode === 'base' ? 'enter-free' : (frame.awardedFreeSpins || 0) > 0 ? 'retrigger' : 'next-free') : frame.mode === 'free' ? 'end-free' : 'complete';
    return { transition, remaining: frame.freeRemaining, awarded: frame.awardedFreeSpins || 0 };
}
/** Stops repeated native stop callbacks from presenting the same receipt twice. */
export class FrameGate {
    private last = '';
    accept(frame: Frame) { const key = frame.requestId || `${frame.betId}:${frame.spinIndex}:${frame.stepIndex}`; if (key === this.last)
        return false; this.last = key; return true; }
    reset() { this.last = ''; }
}
export class AutoBudget {
    remaining = 0;
    set(count: number) { this.remaining = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0; }
    take(): boolean { if (this.remaining <= 0)
        return false; this.remaining--; return true; }
}
