const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {sortAwardLayer}=require('../assets/mahjongway/src/effects/award_layer.ts');
function layer(ys){const layer={children:[]};layer.children=ys.map(y=>({worldPosition:{y},setSiblingIndex(index){const old=layer.children.indexOf(this);layer.children.splice(old,1);layer.children.splice(index,0,this);}}));return layer;}
test('lower winning tile renders above the adjacent upper winning tile',()=>{
 const l=layer([0,100]);const [bottom,top]=l.children;sortAwardLayer(l);assert.deepEqual(l.children,[top,bottom]);
});
test('reused anchors are reordered after their physical positions change',()=>{
 const l=layer([100,0,-100]);const [a,b,c]=l.children;sortAwardLayer(l);
 a.worldPosition.y=-200;c.worldPosition.y=200;sortAwardLayer(l);assert.deepEqual(l.children,[c,b,a]);
});
test('partial wins and different columns consistently render from top to bottom',()=>{
 const l=layer([-100,200,0,100]);sortAwardLayer(l);assert.deepEqual(l.children.map(a=>a.worldPosition.y),[200,100,0,-100]);
});
