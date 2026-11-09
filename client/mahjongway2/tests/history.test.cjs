const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../../../slot_math/node_modules/typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const { money, fraction, dateRange, recentDates, gameBounds } = require('../assets/mahjongway/src/history/history_model.ts');
test('history money keeps integer precision and scales fractional per-line values', () => {
    assert.equal(money('900719925474099301',2,'USD'), '$9,007,199,254,740,993.01');
    assert.equal(money('-101',2,'USD'), '−$1.01');
    assert.equal(fraction('1/8'), '0.125');
    assert.equal(fraction('25',4,2), '0.25');
});
test('history dates use GMT+8 and accept at most seven inclusive calendar days', () => {
    assert.deepEqual(recentDates(7,Date.parse('2026-10-29T17:00:00Z')), {start:'2026-10-24',end:'2026-10-30'});
    assert.deepEqual(dateRange('2026-10-24','2026-10-30'), {from:'2026-10-23T16:00:00.000Z',to:'2026-10-30T16:00:00.000Z'});
    for (const pair of [['2026-02-31','2026-02-31'], ['2026-10-30','2026-10-29'], ['2026-10-23','2026-10-30']]) assert.throws(()=>dateRange(...pair));
});
test('history overlay stays inside centered game area on wide and narrow screens', () => {
    assert.deepEqual(gameBounds({left:0,top:0,width:1200,height:1400}),{left:225,top:0,width:750,height:1400});
    assert.deepEqual(gameBounds({left:0,top:0,width:375,height:800}),{left:0,top:50,width:375,height:700});
});
const historyRecord = {betId:'bet',betAmount:'200',totalWinAmount:'300',profitAmount:'100',winningRoundCount:1,totalRoundCount:2};
const historySummary = {recordCount:1,betAmount:'200',totalWinAmount:'300',profitAmount:'100'};
const {GameApi} = require('../assets/mahjongway/src/network/game/game_api.ts');
test('history requests are read-only and preserve next spin nonce', async () => {
    const calls=[];
    const api = new GameApi('', {appname:'p',appkey:'a',uid:'u',gameId:'AG1',test:true}, async (route,body) => {
        calls.push([route,body]);
        if(route.endsWith('/state')) return {requestId:'unchanged',hasNext:false};
        if(route.includes('/replay?')) return {bet:historyRecord,amountScale:0,frames:[]};
        if(route.includes('/bet-records?')) return {items:[historyRecord],amountScale:0,summary:historySummary};
        return {nextRequestId:'next'};
    });
    await api.state();
    await api.historyRecords({from:'2026-10-23T16:00:00Z',to:'2026-10-30T16:00:00Z'});
    await api.historyReplay('bet/id');
    assert.equal(calls.length,3);
    assert.match(calls[1][0], /bet-records\?/);
    assert.match(calls[2][0], /bet%2Fid\/replay\?/);
    assert.equal(calls[1][1],undefined);
    assert.equal(calls[2][1],undefined);
    await api.spin('200');
    assert.deepEqual(calls[3][1],{requestId:'unchanged',betAmount:'200'});
});
test('history money survives exponent downleveling used by web builds', () => {
    const vm = require('node:vm');
    const source = fs.readFileSync(require.resolve('../assets/mahjongway/src/history/history_model.ts'),'utf8');
    const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText;
    const sandbox = { exports: {} };
    vm.runInNewContext(output,sandbox);
    assert.equal(sandbox.exports.money('123456',2,'USD'),'$1,234.56');
    assert.equal(sandbox.exports.fraction('25',4,2),'0.25');
    assert.equal(sandbox.exports.fraction('1/8'),'0.125');
});

const {historyListResponse,historyReplayResponse} = require('../assets/mahjongway/src/history/history_response.ts');
test('old history server is rejected before rendering missing profit or summary', async () => {
    assert.throws(()=>historyListResponse({items:[{betId:'old',betAmount:'200',totalWinAmount:'300'}]}),/重启/);
    assert.throws(()=>historyListResponse({items:[],amountScale:0}),/重启/);
    const api = new GameApi('',undefined,async()=>({items:[]}));
    await assert.rejects(api.historyRecords({from:'a',to:'b'}),/重启/);
    assert.throws(()=>historyReplayResponse({bet:historyRecord,amountScale:0,frames:[{board:[],wins:[]}]}),/重启/);
    assert.doesNotThrow(()=>historyListResponse({items:[historyRecord],amountScale:0,summary:historySummary}));
});
