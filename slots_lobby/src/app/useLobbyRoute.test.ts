import { afterEach, expect, it, vi } from 'vitest';
import { guardLobbyEntry, pushLobbyLocation, returnToLobbySource } from './useLobbyRoute';

afterEach(() => window.history.replaceState(null, '', '/'));

it('redirects external subpage entries to home and keeps the invite code', () => {
  window.history.replaceState(null, '', '/my?inviteCode=ABC&orderId=123');
  guardLobbyEntry();
  expect(window.location.pathname + window.location.search).toBe('/?inviteCode=ABC');
});

it('retains the current page and filters when reinitializing an internal entry', () => {
  pushLobbyLocation('/agent?view=team&page=2', { agent: true });
  guardLobbyEntry();
  expect(window.location.pathname + window.location.search).toBe('/agent?view=team&page=2');
  expect(window.history.state.agent).toBe(true);
});

it.each(['/', '/benefits', '/vip', '/earn', '/my', '/withdrawal?orderId=withdraw-123'])('returns to the original entry %s without losing query state', source => {
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  pushLobbyLocation('/agent', { lobbyFrom: source });
  returnToLobbySource();
  expect(back).toHaveBeenCalledOnce();
  back.mockRestore();
});

it('allows a shared game page but removes credentials and arbitrary query parameters',()=>{
 window.history.replaceState(null,'','/game/AG2?sid=private&launchTicket=private');
 guardLobbyEntry();
 expect(window.location.pathname+window.location.search).toBe('/game/AG2');
 expect(window.history.state.lobbyInternal).toBe(true);
});
