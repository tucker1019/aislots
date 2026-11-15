import { JsonAsset, resources } from 'cc';
import type { HistoryArt } from './history_types';
let pending: Promise<HistoryArt> = null;
export function loadHistoryArt() {
    if (!pending)
        pending = new Promise<HistoryArt>((resolve, reject) => {
            resources.load('history/art', JsonAsset, (error, asset) => {
                if (error) {
                    pending = null;
                    reject(error);
                    return;
                }
                const value: unknown = asset.json;
                if (!value || typeof value !== 'object' || Array.isArray(value)) {
                    pending = null;
                    reject(new Error('记录页美术资源无效'));
                    return;
                }
                const art: HistoryArt = {};
                for (const [key, source] of Object.entries(value))
                    if (typeof source === 'string' && source.startsWith('data:image/png;base64,'))
                        art[key] = source;
                resolve(art);
            });
        });
    return pending;
}
