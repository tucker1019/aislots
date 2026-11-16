import { Frame } from './game_types';
export function formatMinor(value: number, _group = true): string { const whole = Math.trunc(value / 100); return (Object.is(whole, -0) ? 0 : whole).toLocaleString('id-ID', { maximumFractionDigits: 0 }); }
export function restoredFree(frame: Frame): boolean { return frame.mode === 'free' && frame.nextAction !== 'complete'; }
export function resolutionFit(width: number, height: number): 'width' | 'height' { return width / height <= 750 / 1334 ? 'width' : 'height'; }
