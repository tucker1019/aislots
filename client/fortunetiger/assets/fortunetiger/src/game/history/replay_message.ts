export function replayMessage(event: {source: unknown; origin: string; data: unknown}, source: unknown, origin: string, channel: string, type: string): boolean {
    if (event.source !== source || event.origin !== origin || !event.data || typeof event.data !== 'object') return false;
    const data = event.data as Record<string, unknown>;
    return data.type === type && data.channel === channel;
}
