import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toOriginalSpin, originalCell, LINES, PAYOUTS} from '../assets/fortunemouse-code/game/net/FMResultAdapter.ts';

const service = new URL('../../../slots_service/', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, service), 'utf8'));
const examples = json('testdata/ag6-client-examples.json');
const math = json('testdata/deployments/2026-11-15-ag6/AG6/paylines.json');
assert.deepEqual(LINES, math.lines);
assert.deepEqual(PAYOUTS, math.symbols.map(s => s.payout));
assert.deepEqual([1,2,3,4,5,6,7,8,9].map(originalCell), [7,4,1,8,5,2,9,6,3]);
for (const [name, example] of Object.entries(examples)) {
    let paid = 0;
    for (const f of example.frames) {
        const frame = {...f, ...f.display, betAmount: example.betAmount, totalWinAmount: f.winAmount};
        const {rotate} = toOriginalSpin(frame);
        assert.equal(rotate.mAwardList.reduce((sum, award) => sum + award.mMoney, 0), f.winAmount);
        if (frame.gameData.special) assert.deepEqual([1,4,7].map(i => rotate.mIcons[i]), [7,7,7]);
        if (frame.gameData.jackpot) {
            assert.equal(rotate.mAwardList.length, 1);
            assert.equal(rotate.mAwardList[0].flag_id, 0);
            assert.equal(frame.winAmount, frame.betAmount * 1000);
        } else assert(rotate.mAwardList.every(a => a.flag_id > 0));
        paid += f.winAmount;
    }
    assert.equal(paid, example.totalWinAmount);
    console.log(name + ': ' + example.frames.length + ' frame(s)');
}
