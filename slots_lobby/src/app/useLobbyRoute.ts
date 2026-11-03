import { useSyncExternalStore } from 'react';
export type LobbyRoute = 'vip' | 'vip-details' | 'home' | 'my' | 'deposit' | 'game' | 'records' | 'bet-records' | 'benefits' | 'wallet-ledger' | 'earn' | 'earn-rules';
const routeEvent = 'lobby:navigate';
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener(routeEvent, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(routeEvent, listener);
  };
}
function readLocation() { return window.location.pathname + window.location.search; }
function routeFor(path: string): LobbyRoute {
  return path === '/earn/rules' ? 'earn-rules' : path === '/earn' ? 'earn' : path === '/vip/details' ? 'vip-details' : path === '/vip' ? 'vip' : path === '/wallet-ledger' ? 'wallet-ledger' : path === '/benefits' ? 'benefits' : path === '/bet-records' ? 'bet-records' : path === '/game/AG1' ? 'game' : path === '/my' ? 'my' : path === '/deposit' ? 'deposit' : path === '/records' ? 'records' : 'home';
}
export function useLobbyRoute() {
  const location = useSyncExternalStore(subscribe, readLocation, () => '/');
  const [path, search] = location.split('?');
  const rawId = new URLSearchParams(search).get('orderId');
  return { view: routeFor(path.replace(/\/$/, '')), orderId: rawId && rawId.length <= 128 ? rawId : undefined, navigate: navigateLobby };
}

export function navigateLobby(next: LobbyRoute, options?: { orderId?: string }) {
  const path = next === 'earn-rules' ? '/earn/rules' : next === 'earn' ? '/earn' : next === 'vip-details' ? '/vip/details' : next === 'vip' ? '/vip' : next === 'wallet-ledger' ? '/wallet-ledger' + (options?.orderId ? '?orderId=' + encodeURIComponent(options.orderId) : '') : next === 'benefits' ? '/benefits' : next === 'bet-records' ? '/bet-records' : next === 'records' ? '/records' + (options?.orderId ? '?orderId=' + encodeURIComponent(options.orderId) : '') : next === 'game' ? '/game/AG1' : next === 'my' ? '/my' : next === 'deposit' ? '/deposit' : '/';
  if (window.location.pathname + window.location.search !== path) {
    window.history.pushState({ lobbyFrom: window.location.pathname + window.location.search }, '', path);
    window.dispatchEvent(new Event(routeEvent));
  }
  document.getElementById('root')?.scrollTo({ top: 0 });
}
