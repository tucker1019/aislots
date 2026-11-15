import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toOriginalSpin, originalCell, LINES, PAYOUTS} from '../assets/fortuneox-code/game/net/FOXResultAdapter.ts';

const service = new URL('../../../slots_service/', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, service), 'utf8'));
const examples = json('testdata/ag7-client-examples.json');
const math = json('testdata/deployments/2026-11-15-ag7/AG7/paylines.json');
assert.deepEqual(LINES, math.lines);
assert.deepEqual(PAYOUTS, math.symbols.map(s => s.payout));
assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(originalCell), [7,4,1,11,8,5,2,9,6,3]);
for (const [name, example] of Object.entries(examples)) {
    let paid = 0;
    for (const f of example.frames) {
        const frame = {...f, ...f.display, betAmount: example.betAmount, totalWinAmount: f.winAmount};
        const {rotate} = toOriginalSpin(frame);
        assert.equal(rotate.mAwardList.reduce((sum, award) => sum + award.mMoney, 0), f.winAmount);
        if (frame.gameData.special) assert.deepEqual([0,2,3,5,6,8].map(i => rotate.mIcons[i]), Array(6).fill(frame.gameData.sharedSymbolId));
        if (frame.gameData.jackpot) {
            assert.equal(rotate.mAwardList.length, 1);
            assert.equal(rotate.mAwardList[0].flag_id, 0);
            assert.equal(frame.winAmount, frame.betAmount * 2000);
        } else assert(rotate.mAwardList.every(a => a.flag_id > 0));
        paid += f.winAmount;
    }
    assert.equal(paid, example.totalWinAmount);
    console.log(name + ': ' + example.frames.length + ' frame(s)');
}
