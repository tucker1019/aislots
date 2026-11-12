import { Frame } from './game_types';
export function formatMinor(value: number, group = true): string { return (Math.floor(value) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: group }); }
export function restoredFree(frame: Frame): boolean { return frame.mode === 'free' && frame.nextAction !== 'complete'; }
export function resolutionFit(width: number, height: number): 'width' | 'height' { return width / height <= 750 / 1334 ? 'width' : 'height'; }
