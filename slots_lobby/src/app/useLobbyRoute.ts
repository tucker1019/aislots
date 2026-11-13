import { isGameId, type GameId } from './games';
import {useSessionStore} from '../stores/session';
import {useAuthStore} from '../stores/auth';
import { useSyncExternalStore } from 'react';
export type LobbyRoute = 'security' | 'password' | 'profile' | 'withdrawal' | 'wallet-management' | 'agent' | 'invite-friends' | 'personal-report' | 'invite' | 'vip' | 'vip-details' | 'home' | 'my' | 'deposit' | 'game' | 'records' | 'bet-records' | 'benefits' | 'wallet-ledger' | 'earn' | 'offers' | 'earn-rules' | 'loss-return-rules';
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
  return path === '/security/password' ? 'password' : path === '/security' ? 'security' : path === '/offers' ? 'offers' : path === '/earn/loss-return/rules' ? 'loss-return-rules' : path === '/profile' ? 'profile' : path === '/withdrawal' ? 'withdrawal' : path === '/wallet-management' ? 'wallet-management' : path === '/agent' ? 'agent' : path === '/invite/friends' ? 'invite-friends' : path === '/invite' ? 'invite' : path === '/personal-report' ? 'personal-report' : path === '/earn/rules' ? 'earn-rules' : path === '/earn' ? 'earn' : path === '/vip/details' ? 'vip-details' : path === '/vip' ? 'vip' : path === '/wallet-ledger' ? 'wallet-ledger' : path === '/benefits' ? 'benefits' : path === '/bet-records' ? 'bet-records' : (path.startsWith('/game/') && isGameId(path.slice('/game/'.length))) ? 'game' : path === '/my' ? 'my' : path === '/deposit' ? 'deposit' : path === '/records' ? 'records' : 'home';
}
export function guardLobbyEntry() {
  if (window.location.pathname === '/' || window.history.state?.lobbyInternal === true) return;
  const inviteCode = new URLSearchParams(window.location.search).get('inviteCode');
  const search = inviteCode && /^[A-Za-z0-9_-]{1,64}$/.test(inviteCode)
    ? '?' + new URLSearchParams({ inviteCode }) : '';
  window.history.replaceState(null, '', '/' + search);
}

export function pushLobbyLocation(path: string, state: Record<string, unknown> = {}) {
  window.history.pushState({ ...state, lobbyInternal: true }, '', path);
  window.dispatchEvent(new Event(routeEvent));
}

export function useLobbyRoute() {
  const location = useSyncExternalStore(subscribe, readLocation, () => '/');
  const [path, search] = location.split('?');
  const rawId = new URLSearchParams(search).get('orderId');
  const requestedGame = path.replace(/\/$/, '').slice('/game/'.length);
  const gameId: GameId = isGameId(requestedGame) ? requestedGame : 'AG1';
  return { gameId, view: routeFor(path.replace(/\/$/, '')), orderId: rawId && rawId.length <= 128 ? rawId : undefined, navigate: navigateLobby };
}

export function navigateLobby(next: LobbyRoute, options?: { orderId?: string; gameId?: GameId }) {
  if(!['home','offers'].includes(next)&&!useSessionStore.getState().session){useAuthStore.getState().show('login',()=>navigateLobby(next,options));return;}
  const path = next === 'password' ? '/security/password' : next === 'security' ? '/security' : next === 'offers' ? '/offers' : next === 'loss-return-rules' ? '/earn/loss-return/rules' : next === 'profile' ? '/profile' : next === 'withdrawal' ? '/withdrawal'+(options?.orderId?'?orderId='+encodeURIComponent(options.orderId):'') : next === 'wallet-management' ? '/wallet-management' : next === 'agent' ? '/agent' : next === 'invite-friends' ? '/invite/friends' : next === 'invite' ? '/invite' : next === 'personal-report' ? '/personal-report' : next === 'earn-rules' ? '/earn/rules' : next === 'earn' ? '/earn' : next === 'vip-details' ? '/vip/details' : next === 'vip' ? '/vip' : next === 'wallet-ledger' ? '/wallet-ledger' + (options?.orderId ? '?orderId=' + encodeURIComponent(options.orderId) : '') : next === 'benefits' ? '/benefits' : next === 'bet-records' ? '/bet-records' : next === 'records' ? '/records' + (options?.orderId ? '?orderId=' + encodeURIComponent(options.orderId) : '') : next === 'game' ? '/game/' + (options?.gameId ?? 'AG1') : next === 'my' ? '/my' : next === 'deposit' ? '/deposit' : '/';
  if (window.location.pathname + window.location.search !== path) {
    pushLobbyLocation(path, { lobbyFrom: readLocation() });
  }
  document.getElementById('root')?.scrollTo({ top: 0 });
}
