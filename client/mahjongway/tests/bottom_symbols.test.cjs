const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('../../../slot_math/node_modules/typescript');
for(const game of ['mahjongway','mahjongway2']){
 const src=fs.readFileSync(require('node:path').join(__dirname,`../../${game}/assets/${game}/src/slots/server_board.ts`),'utf8');const m={exports:{}};new Function('exports','module',ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m.exports,m);
 const heights=game==='mahjongway'?[4,4,4,4,4]:[4,5,5,5,4];let id=1;const board=heights.map(h=>Array.from({length:h+1},()=>({id:id++,symbolId:1})));
 const bottom=[2,3,1004,5,6],expected=[7,5,1008,6,1];
 const strips=m.exports.serverStrips(board,()=>8,undefined,bottom);
 for(let c=0;c<5;c++){assert.equal(strips[c][heights[c]+2],expected[c]);assert.equal(strips[c][0],8);assert.equal(strips[c][1],11);}
 const again=m.exports.serverStrips(board,()=>1,strips,bottom);assert.deepEqual(again,strips);
 const old=m.exports.serverStrips(board,()=>8);assert.deepEqual(m.exports.serverStrips(board,()=>1,old),old);
 assert.throws(()=>m.exports.serverStrips(board,()=>8,undefined,[2]),/底部格子/);
 console.log(game,'bottom/state/cascade/legacy mapping passed');
}
