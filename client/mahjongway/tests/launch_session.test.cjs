const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../../../slot_math/node_modules/typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpile(fs.readFileSync(f, 'utf8'), {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
}), f);
const { GameApi } = require('../assets/mahjongway/src/network/game/game_api.ts');
function browser(query = '') {
    const values = new Map();
    global.sessionStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
    global.location = new URL('http://game.local/AG1/' + query);
    global.history = { state: null, replaceState: (_state, _title, url) => { global.location = new URL(url, 'http://game.local'); } };
    return values;
}
test('launch retries reuse exchange ID and token; refresh restores game session without test login', async () => {
    const ticket = 'T'.repeat(52); browser('?launchTicket=' + ticket);
    const calls = []; let attempts = 0;
    const request = async (path, body, token) => {
        calls.push({ path, body, token });
        if (path === '/login') { if (++attempts === 1) throw new Error('lost response'); return { accessToken: 'game-token', balance: 123 }; }
        assert.equal(token, 'game-token'); return { requestId: 'nonce', balance: 123 };
    };
    const api = new GameApi('http://api', undefined, request);
    await assert.rejects(api.login());
    const refreshed = new GameApi('http://api', undefined, request); await refreshed.login();
    assert.deepEqual(calls[0].body, calls[1].body); assert.equal(calls[0].body.test, undefined);
    assert.equal(location.search, '');
    await new GameApi('http://api', undefined, request).login();
    assert.equal(calls.filter(c => c.path === '/login').length, 2);
    assert.match(calls.at(-1).path, /\/state$/);
});
test('expired real session and malformed launch links never fall back to a test user', async () => {
    const values = browser('?launchTicket=' + 'T'.repeat(52));
    const api = new GameApi('http://api', undefined, async () => ({ accessToken: 'token', balance: 0 }));
    await api.login(); let calls = 0;
    const expired = new GameApi('http://api', undefined, async () => { calls++; throw Object.assign(new Error('expired'), { status: 401 }); });
    await assert.rejects(expired.login(), /从大厅重新进入/); await assert.rejects(expired.login(), /从大厅重新进入/); assert.equal(calls, 1);
    values.set('aislots-live:http://api:AG1', '{"live":false}');
    await assert.rejects(expired.login(), /从大厅重新进入/);
    location = new URL('http://game.local/?launchTicket=');
    await assert.rejects(expired.login(), /进入凭据无效/);
});
test('iframe parent reload can reuse its consumed launch URL without redeeming the ticket twice', async () => {
    const ticket = 'T'.repeat(52); browser('?launchTicket=' + ticket);
    let exchanges = 0;
    const request = async (path, body, token) => {
        if (path === '/login') { exchanges++; return { accessToken: 'saved-game-session', balance: 500 }; }
        assert.equal(token, 'saved-game-session'); return { requestId: 'nonce', balance: 500 };
    };
    await new GameApi('http://api', undefined, request).login();
    location = new URL('http://game.local/?launchTicket=' + ticket);
    await new GameApi('http://api', undefined, request).login();
    assert.equal(exchanges, 1); assert.equal(location.search, '');
    location = new URL('http://game.local/?launchTicket=' + 'N'.repeat(52));
    await new GameApi('http://api', undefined, request).login();
    assert.equal(exchanges, 2);
});
