const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
const Module=require('node:module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText,f);
const {serverStrips,gravitySources}=require('../assets/mahjongway2/src/slots/server_board.ts');
const {initialStrips}=require('../assets/mahjongway2/src/slots/initial_board.ts');
test('AG2 accepts 45554 active cells and preserves each column decoration',()=>{
 let id=1;
 const board=[4,5,5,5,4].map(height=>Array.from({length:height+1},()=>({id:id++,symbolId:2})));
 const first=serverStrips(board,()=>7);
 assert.deepEqual(first.map(col=>col.length),[8,8,8,8,8]);
 const old=first.map(col=>{col[col.length-1]=8;return col;});
 const next=serverStrips(board,()=>1,old);
 assert.deepEqual(next.map(col=>col.at(-1)),[8,8,8,8,8]);
 assert.deepEqual(initialStrips().map(col=>col.length),[8,8,8,8,8]);
 const legacy = board.map(col=>col.slice(1));
 const restored = serverStrips(legacy,()=>1);
 assert.deepEqual(restored.map(col=>col.length),[8,8,8,8,8]);
 assert.deepEqual(gravitySources(legacy,board).map(col=>col.slice(1)),board.map(col=>col.slice(1).map((_,i)=>i+1)));
 assert.throws(()=>serverStrips(board.map(col=>col.slice(0,3)),()=>1),/有效格数量错误/);
});
const original=Module._load;
Module._load=function(id,parent,...args){
 if(id==='cc')return {_decorator:{ccclass:()=>c=>c,property:()=>{}},Component:class{}};
 if(id==='./slots_base'||id==='./slots_cell')return {};
 if(id==='../effects/award_layer')return {sortAwardLayer(){}};
 if(id==='./slot_widget')return {createSpinCellPicker:()=>Object.assign(()=>1,{refill(){}})};
 return original.call(this,id,parent,...args);
};
const {slots_r}=require('../assets/mahjongway2/src/slots/slots_r.ts');
Module._load=original;
test('both reel lengths settle and expose all active rows including the fifth',()=>{
 for(const count of [7,8]){
  const reel=new slots_r();
  reel.index=count===7?0:1;
  const cells=Array.from({length:count},(_,i)=>{
   const component={setBlur(){},setCellValue(){},playScatterStop(){},cancelAward(){}};
   return {position:{y:165+(count-7)*82.5-i*165},getComponent:()=>component,setSiblingIndex(){},setPosition(x,y){this.position.y=y;}};
  });
  reel.node={children:cells};reel.slots={boards:[Array(count).fill(1)]};
  reel.bindPicker();
  assert.equal(reel.activeRowForCell(cells[count-2]),count-4);
  assert.equal(reel.activeRowForCell(cells[count-1]),-1);
  for(let anchor=0;anchor<count;anchor++){
   reel.settleAnchor=anchor;reel.computeStopInitY(anchor);
   assert.deepEqual(cells.map((_,i)=>reel.getResultRank(i)).sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i));
  }
  reel.settleAnchor=-1;
  reel.dropTo(Array(count).fill(1),Array.from({length:count-2},(_,i)=>i));
  assert.equal(reel.targets.length,count);
  assert.equal(reel.drops.length,count);
  assert.ok(reel.targets.every(Number.isFinite));
 }
});
test('equal strip lengths stop together in turbo while edges retain four active rows',()=>{
 const reels=[8,8,8,8,8].map((count,index)=>{
  const reel=new slots_r();
  const cells=Array.from({length:count},(_,i)=>{
   const component={setBlur(){},setCellValue(){},playScatterStop(){}};
   return {position:{y:150-i*150},getComponent:()=>component,setSiblingIndex(){},setPosition(x,y){this.position.y=y;}};
  });
  reel.node={children:cells};reel.index=index;
  reel.slots={fast:true,boards:Array.from({length:5},()=>Array(count).fill(1))};
  reel.bindPicker();reel.startRoll();reel.stopRoll(Array(count).fill(1));
  return reel;
 });
 const settled=[];
 for(let tick=0;tick<200;tick++){
  reels.forEach((reel,index)=>{
   const before=reel.state;
   reel.tick(1/60,1/120);
   if(before!==0&&reel.state===0)settled[index]=tick;
  });
  if(settled.filter(value=>value!==undefined).length===5)break;
 }
 assert.equal(settled.length,5,JSON.stringify(reels.map(r=>({state:r.state,landed:r.getLandedCount(),speed:r.scrollSpeed,top:r.cellNodes[0].position.y}))))
 assert.ok(settled.every(value=>value!==undefined));
 assert.equal(new Set(settled).size,1);
 for(const reel of [reels[0],reels[4]]){
  const padding=reel.cellNodes.find((_,index)=>reel.getResultRank(index)===6);
  assert.equal(reel.activeRowForCell(padding),-1);
 }
});
