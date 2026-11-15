import { JsonAsset, resources } from 'cc';
import type { HistoryArt } from './history_types';

let pending: Promise<HistoryArt>;
export function loadHistoryArt() {
    return pending ??= new Promise<HistoryArt>((resolve, reject) => {
        resources.load('history/art', JsonAsset, (error, asset) => {
            if (error) { pending = undefined; reject(error); return; }
            resolve(asset.json as HistoryArt);
        });
    });
}
