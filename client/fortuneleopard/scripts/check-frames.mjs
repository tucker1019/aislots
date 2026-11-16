import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../../../', import.meta.url);
const parity = JSON.parse(readFileSync(new URL('slots_service/testdata/ag9-parity.json', root), 'utf8'));
for (const [index, item] of parity.cases.entries()) {
 assert.equal(item.board.length, 9, `case ${index} board`);
 assert(Number.isInteger(item.stake) && item.stake > 0);
 assert(Number.isInteger(item.bonus) && [1,10].includes(item.bonus));
 assert(BigInt(item.win) >= 0n);
 for (const win of item.wins) assert(win.cellIds.length === 3 && win.lineIndex >= 0 && win.lineIndex < 5);
}
console.log(`AG9 parity: ${parity.cases.length} cases and ${parity.skeletonCases.length} skeleton cases`);
