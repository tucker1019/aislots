const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {symbolTip,tipPosition}=require('../assets/mahjongway/src/effects/symbol_tip_model.ts');
test('artwork IDs and gold variants resolve to the same HTML paytable numbers',()=>{
 assert.deepEqual(symbolTip(2).payout,[100,60,15]);assert.deepEqual(symbolTip(1002).payout,symbolTip(2).payout);
 assert.deepEqual(symbolTip(1).payout,[40,15,6]);assert.deepEqual(symbolTip(7).payout,[10,5,2]);
});
test('wild/scatter descriptions are Chinese and do not invent ordinary-symbol payouts',()=>{
 assert.equal(symbolTip(9).payout,undefined);assert.match(symbolTip(9).description,/胡.*免费/);
 assert.equal(symbolTip(10).payout,undefined);assert.match(symbolTip(10).description,/百搭.*胡/);
});
test('panel opens inward and stays inside the visible board',()=>{
 assert.equal(tipPosition(-300,100,0,false).direction,1);assert.equal(tipPosition(300,100,4,false).direction,-1);
 for(const special of [true,false])for(const x of [-350,350]){
  const p=tipPosition(x,1000,x<0?0:4,special);assert.ok(p.x-p.width/2>=-360);assert.ok(p.x+p.width/2<=360);assert.ok(p.y<=396);
 }
});
test('imported tooltip prefab has editor ownership and no old game scripts',()=>{
 const d=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../assets/resources/mahjong_effects/mult_panel.prefab'),'utf8'));
 for(const name of ['labels','other','label1','label2','label3'])assert.ok(d.some(n=>n._name===name));
 for(const n of d){assert.ok(n.__type__.startsWith('cc.'));if(n.__type__==='cc.Node')assert.equal(d[n._prefab.__id__].__type__,'cc.PrefabInfo');}
});
