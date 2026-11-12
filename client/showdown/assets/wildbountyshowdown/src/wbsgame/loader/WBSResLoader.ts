import { Asset, Constructor, assetManager } from 'cc';
export type ProgressCallback = (completed: number, total: number, item?: unknown) => void;
export type CompleteCallback<T = Asset> = (error: Error | null, data: T) => void;
/** Uses public 3.8.8 asset APIs; no dependency on removed private engine type names. */
export class WBSResLoader {
    loadDir<T extends Asset>(bundleName: string, dir: string, progress: ProgressCallback, complete: CompleteCallback<T[]>) {
        const bundle = assetManager.getBundle(bundleName);
        if (!bundle) {
            complete(new Error('Missing bundle ' + bundleName), []);
            return;
        }
        bundle.loadDir(dir, progress, complete);
    }
    load<T extends Asset>(bundleName: string, path: string, type: Constructor<T>, complete: CompleteCallback<T>): void;
    load<T extends Asset>(bundleName: string, path: string, complete: CompleteCallback<T>): void;
    load<T extends Asset>(bundleName: string, path: string, typeOrComplete: Constructor<T> | CompleteCallback<T>, complete?: CompleteCallback<T>) {
        const bundle = assetManager.getBundle(bundleName);
        const done = complete || typeOrComplete as CompleteCallback<T>;
        if (!bundle) {
            done(new Error('Missing bundle ' + bundleName), null);
            return;
        }
        if (complete)
            bundle.load(path, typeOrComplete as Constructor<T>, complete);
        else
            bundle.load(path, done);
    }
    get<T extends Asset>(path: string, type: Constructor<T>, bundleName = 'resources'): T | null { return assetManager.getBundle(bundleName)?.get(path, type) || null; }
}
