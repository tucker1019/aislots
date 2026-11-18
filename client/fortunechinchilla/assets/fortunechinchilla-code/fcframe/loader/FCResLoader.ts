import { Asset, Constructor, resources } from 'cc';

/** Single-scene resources. Legacy remote game bundles are no longer loaded. */
export class FCResLoader {
    get<T extends Asset>(path: string, type: Constructor<T>, bundleName = 'resources'): T | null {
        if (bundleName !== 'resources') throw new Error('Unsupported resource bundle: ' + bundleName);
        return resources.get(path, type);
    }

    load<T extends Asset>(bundleName: string, path: string, type: Constructor<T>, complete: (error: Error | null, asset: T) => void) {
        if (bundleName !== 'resources') throw new Error('Unsupported resource bundle: ' + bundleName);
        resources.load(path, type, complete);
    }

    release(path: string) { resources.release(path); }
}
