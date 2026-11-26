import { isAndroidApp } from './atomic-params';

interface NativeBridgeError {
  code: string;
  message: string;
}

interface NativeBridgeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: NativeBridgeError;
}

interface AndroidBridgeObject {
  postMessage: (payloadJson: string) => void;
}

declare global {
  interface Window {
    AggamesBridge?: AndroidBridgeObject;
    __aggamesBridgeCallback?: (id: string, response: NativeBridgeResponse) => void;
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingRequests = new Map<string, PendingRequest>();
let requestSequence = 0;

function ensureCallbackHandler(): void {
  if (typeof window === 'undefined') return;
  if (window.__aggamesBridgeCallback) return;

  window.__aggamesBridgeCallback = (id: string, response: NativeBridgeResponse) => {
    const pending = pendingRequests.get(id);
    if (!pending) return;
    pendingRequests.delete(id);
    clearTimeout(pending.timer);

    if (response && response.ok) {
      pending.resolve(response.data);
      return;
    }
    const message = response?.error?.message || 'Native bridge call failed';
    const err = new Error(message) as Error & { code?: string };
    if (response?.error?.code) {
      err.code = response.error.code;
    }
    pending.reject(err);
  };
}

export function hasNativeBridge(): boolean {
  return typeof window !== 'undefined' && typeof window.AggamesBridge?.postMessage === 'function';
}

export function shouldUseNativeBridge(): boolean {
  return isAndroidApp() && hasNativeBridge();
}

export function callNativeBridge<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
  timeoutMs = 30000,
): Promise<T> {
  if (!hasNativeBridge()) {
    return Promise.reject(new Error('Native JSBridge is not available'));
  }
  ensureCallbackHandler();

  const id = `agg_${Date.now()}_${++requestSequence}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Native bridge timeout: ${action}`));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
      timer,
    });

    try {
      window.AggamesBridge?.postMessage(JSON.stringify({ id, action, params }));
    } catch (error) {
      pendingRequests.delete(id);
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error('Failed to post bridge message'));
    }
  });
}
