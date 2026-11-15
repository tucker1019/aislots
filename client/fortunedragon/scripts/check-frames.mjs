import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boardToIcons, toOriginalSpin, wagerAmount} from '../assets/fortunedragon-code/game/net/FDResultAdapter.ts';

const examples = JSON.parse(readFileSync(new URL('../../../slots_service/testdata/ag8-client-examples.json', import.meta.url)));
for (const [name, result] of Object.entries(examples)) {
    let totalWinAmount = 0;
    for (const f of result.frames) {
        totalWinAmount += f.winAmount;
        const frame = {...f,...f.display,betAmount:result.betAmount,totalWinAmount};
        const {rotate} = toOriginalSpin(frame);
        assert.equal(rotate.mAwardList.reduce((n,w) => n+w.mMoney, 0), f.winAmount);
        assert.equal(frame.betAmount, wagerAmount('10',1,5,frame.buyMode));
        assert.deepEqual(rotate.awardMul, frame.gameData.blankMultiplier ? [0] : frame.gameData.multipliers);
        for (const award of rotate.mAwardList) {
            assert(award.mIconIdxs.every(id => id >= 1 && id <= 9));
            assert.equal(new Set(award.mIconIdxs.map(id => (id-1)%3)).size, 3);
        }
    }
    assert.equal(totalWinAmount, result.totalWinAmount);
    assert.equal(result.frames.at(-1).nextAction,'complete');
    console.log(name, result.frames.length, totalWinAmount);
}
assert.deepEqual(boardToIcons([[1,2,3],[4,5,6],[7,1,2]].map((col,c) =>
    col.map((symbolId,r) => ({id:c*3+r+1,symbolId})))).icons,[3,6,2,2,5,1,1,4,7]);
