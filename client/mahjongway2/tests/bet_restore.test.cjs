const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/mahjongway/src/slots/slots_base.ts'),'utf8');
const body=source.match(/private restoreBetChoice\(total: string\) \{([\s\S]*?)\n    \}/)[1];
const restore=new Function('total',body);
test('恢复服务端数字金额和旧字符串金额，续局沿用原投注而非默认档位',()=>{
 for(const total of [1000,'1000']) {
  const state={bet:'10',betLevel:1,betChoices:[{bet:'10',level:1},{bet:'50',level:1}],totalBet:(bet,level)=>String(BigInt(bet)*20n*BigInt(level))};
  restore.call(state,total);
  assert.equal(state.bet,'50');assert.equal(state.betLevel,1);
 }
});
