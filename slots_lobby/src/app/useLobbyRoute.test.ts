import { afterEach, expect, it } from 'vitest';
import { guardLobbyEntry, pushLobbyLocation } from './useLobbyRoute';

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
