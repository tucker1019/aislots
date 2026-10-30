const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {bigWinFrame}=require('../assets/mahjongway/src/effects/big_win_progression.ts');
test('Mega begins as Big and upgrades exactly at 15x without resetting count',()=>{
 assert.deepEqual(bigWinFrame('3000','100',2,0),{tier:1,amount:'0'});
 assert.deepEqual(bigWinFrame('3000','100',2,4),{tier:2,amount:'1500'});
 assert.deepEqual(bigWinFrame('3000','100',2,8),{tier:2,amount:'3000'});
});
test('Super visits all tiers; very large wins do not skip Big or Mega',()=>{
 for(const [age,tier] of [[0,1],[2,1],[3,2],[5,2],[6,3],[8,3]])assert.equal(bigWinFrame('9007199254740993000','100',3,age).tier,tier);
 assert.equal(bigWinFrame('9007199254740993000','100',3,8).amount,'9007199254740993000');
 let prior=0n;
 for(let tick=0;tick<=800;tick++) {const value=BigInt(bigWinFrame('9007199254740993000','100',3,tick/100).amount);assert.ok(value>=prior);prior=value;}
});
test('exact thresholds still show final tier and Big-only awards stay Big',()=>{
 assert.deepEqual(bigWinFrame('1500','100',2,8),{tier:2,amount:'1500'});
 assert.deepEqual(bigWinFrame('5000','100',3,8),{tier:3,amount:'5000'});
 assert.deepEqual(bigWinFrame('500','100',1,4),{tier:1,amount:'250'});
});
