// Drives the unchanged original client through its binary WebSocket protocol.
// Run against a local build only. No request reaches the former platform.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { chromium } = require('playwright');
const source = path.resolve(__dirname, '../../assets/fortunetiger/src/game');
function load(file) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(source, file), 'utf8'), {
        compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    }).outputText, { exports, TextEncoder, TextDecoder, require: () => ({}) });
    return exports;
}
const codec = load('3rd/game_1017.ts');
const hall = load('3rd/hall.ts');
const fixtures = load('view/layer/FTMsgData.ts');
const { toOriginalAward, originalBoard } = load('net/FTResultAdapter.ts');
const long = n => ({low: n | 0, high: Math.floor(n / 4294967296), unsigned:false});
async function run(browser, name, result, expected) {
    const page = await browser.newPage({ viewport: {width: 390, height: 844} });
    try {
        const events = [], errors = [];
        page.on('pageerror', e => { errors.push(e.message); if(process.env.AG4_TRACE) console.error(e.stack); });
        page.on('console', m => { if (process.env.AG4_TRACE) console.log(m.text().slice(0,300)); });
        await page.routeWebSocket(/.*/, ws => {
            ws.onMessage(msg => {
                const binary = Buffer.from(msg);
                const cmd = binary.readUInt16BE();
                events.push(cmd);
                let reply;
                if (cmd === 101) reply = [102, hall.encodeloginS2C({...fixtures.LOGIN_DATA_102.data, mUserID:1, mAccount:'offline', mNickName:'offline', mPassWord:'offline', mHeadIndex:'', mNewServerIp:undefined, mBank:long(0), mMoney:'100000'})];
                else if (cmd === 143) reply = [144, hall.encoderequestEnterGameS2C({...fixtures.ENTER_GAME_DATA_144.data, mRenew:0})];
                else if (cmd === 10171) reply = [10172, codec.encodegetGameStateS2C({mMultiples:[10,50], mMoney:long(100000)})];
                else if (cmd === 10173) reply = [10174, codec.encoderequestOpenAwardS2C(result)];
                else if (cmd === 1) reply = [2, hall.encodeheartBeatS2C({sign:1})];
                else throw Error('Unexpected request: ' + cmd);
                const header = Buffer.alloc(2); header.writeUInt16BE(reply[0]);
                ws.send(Buffer.concat([header, Buffer.from(reply[1])]));
            });
        });
        const base = process.env.AG4_ORIGINAL_URL || 'http://127.0.0.1:5194/';
        const url = new URL(base);
        assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
        url.search = 'uid=offline&sid=offline&countryCode=ID&lang=en';
        await page.goto(url.href);
        let ready = false;
        for (let attempt=0; attempt<150 && !ready; attempt++) {
            ready = await page.evaluate(async () => {
            if (!window.System) return false;
            try {
                const cc = await System.import('cc');
                const game = cc.find('Canvas/GameLayer')?.getComponent('FTGameLayerCtrl');
                if (!game?.centerRollCtrl?.cellLayerCtrlList?.length) return false;
                window.__game = game;
                return true;
            } catch { return false; }
            });
            if (!ready) await page.waitForTimeout(300);
        }
        assert.ok(ready, JSON.stringify({events,errors}));
        await page.evaluate(() => {
            const game = window.__game, roll = game.centerRollCtrl;
            window.__trace = [];
            for (const method of ['startRotation','setCanStop','oneRoundEnd','playAvatarAnim','playWildFlyAnim','triFreeGameAnim','showTriFreeGuang','playOneLine','playMultAnim','playMultAnimNormal','showBottomWin','showBottomWinFull','roundEnd']) {
                const fn = roll[method];
                roll[method] = function(...args) {
                    window.__trace.push([method, typeof args[0] === 'string' || typeof args[0] === 'number' ? args[0] : null, Math.round(performance.now())]);
                    return fn.apply(this,args);
                };
            }
            void game.optCtrl.onGoBtnClick(true);
        });
        await page.waitForFunction(() => window.__trace.some(e => e[0] === 'roundEnd'), {}, {timeout:65000}).catch(async error => { console.error(errors, await page.evaluate(()=>window.__trace)); throw error; });
        assert.deepEqual(events.filter(c=>c!==1),[101,143,10171,10173]);
        assert.deepEqual(errors,[]);
        await page.waitForTimeout(550);
        const resultView = await page.evaluate(() => ({
            trace:window.__trace,
            award:window.__game.optCtrl.lab_award_num.string,
            board:Array.from({length:9},(_,i)=>window.__game.centerRollCtrl.getCellByIdx(i).components.find(c=>'type' in c)?.type),
        }));
        if (expected) {
            assert.deepEqual(resultView.board, Array.from(expected.board));
            assert.equal(resultView.trace.filter(e => e[0] === 'oneRoundEnd').length, expected.steps);
            assert.ok(resultView.trace.some(e => e[0] === 'triFreeGameAnim') === (expected.mode === 'respin'));
            const lines = new Set(resultView.trace.filter(e => e[0] === 'playOneLine').map(e => e[1]));
            for (const line of expected.lines) assert.ok(lines.has(line), 'missing original line ' + line);
        }
        console.log(name,JSON.stringify(resultView));
    } finally { await page.close(); }
}
(async () => {
    const browser = await chromium.launch({channel:'chrome', headless:true});
    try {
        for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['normal2Data','normal1Data']) {
            if (name.endsWith('.json')) {
                const { frames } = JSON.parse(fs.readFileSync(name, 'utf8')).data;
                const last = frames.at(-1);
                const result = toOriginalAward(frames, 0, 0);
                assert.equal(result.win_money_all.low, Number(last.totalWinAmount) | 0);
                await run(browser, path.basename(name), result, {
                    board: originalBoard(last.board), steps: frames.length, mode: last.mode,
                    lines: last.gameData.lineWins.map(line => line.lineIndex),
                });
                continue;
            }
            assert.ok(fixtures[name]?.data?.mRotateData);
            await run(browser,name,fixtures[name].data);
        }
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
