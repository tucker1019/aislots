const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('../../../slot_math/node_modules/typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/mahjongway2/src/slots/slot_widget.ts'),'utf8');const mod={exports:{}};new Function('exports','module',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod.exports,mod);
const {freeSpinCell,createSpinCellPicker}=mod.exports;
test('AG2 free third reel always renders ordinary random symbols gold, preserving specials and other columns',()=>{
 for(let id=1;id<=8;id++){assert.equal(freeSpinCell(id,2,true),1000+id);assert.equal(freeSpinCell(1000+id,2,true),1000+id);assert.equal(freeSpinCell(id,2,false),id);assert.equal(freeSpinCell(id,1,true),id);}
 for(const id of [9,10])assert.equal(freeSpinCell(id,2,true),id);
 let free=true;const pick=createSpinCellPicker(2,()=>free);for(let i=0;i<1000;i++){const v=pick();assert.ok(v===9 || v>1000);}
 free=false;assert.equal(freeSpinCell(3,2,free),3);
});
