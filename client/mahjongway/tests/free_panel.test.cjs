const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const ts=require('../../../slot_math/node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {FreePanelView}=require('../assets/mahjongway/src/effects/free_panel.ts');
function setup(menu=false){const n={root:{active:false},normal:{active:!menu},menu:{active:menu},remaining:{active:false},last:{active:false},counter:{string:''}};return {n,view:new FreePanelView(n)};}
test('free mode replaces both operation panels and displays authoritative remaining count',()=>{
 const {n,view}=setup();view.update(true,7);assert.equal(n.root.active,true);assert.equal(n.normal.active,false);assert.equal(n.menu.active,false);assert.equal(n.remaining.active,true);assert.equal(n.last.active,false);assert.equal(n.counter.string,'7');
 view.update(true,7);assert.equal(n.counter.string,'7');view.update(true,10);assert.equal(n.counter.string,'10');
});
test('zero remaining displays last free spin until feature finishes, then restores normal controls',()=>{
 const {n,view}=setup();view.update(true,0);assert.equal(n.remaining.active,false);assert.equal(n.last.active,true);
 view.update(false,0);assert.equal(n.root.active,false);assert.equal(n.normal.active,true);assert.equal(n.menu.active,false);
});
test('return restores previous menu state and pending menu animation cannot cover the free counter',()=>{
 const {n,view}=setup(true);view.update(true,3);n.menu.active=true;view.update(true,3);assert.equal(n.menu.active,false);
 view.update(false,0);assert.equal(n.menu.active,true);assert.equal(n.normal.active,false);view.update(false,0);assert.equal(n.menu.active,true);
});
test('free panel prefab has editor ownership and contains remaining/last variants',()=>{
 const d=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../assets/resources/mahjong_effects/panel_free.prefab'),'utf8'));
 for(const name of ['remaining_fs','last_fs','fnt_1'])assert.ok(d.some(n=>n._name===name));
 for(const n of d){if(n.__type__==='cc.Node')assert.equal(d[n._prefab.__id__].__type__,'cc.PrefabInfo');else if(n.node)assert.equal(d[n.__prefab.__id__].__type__,'cc.CompPrefabInfo');}
});
test('money footer shifts below the free indicator once and restores without drift',()=>{
 const {n}=setup();const node={position:{x:12,y:-439,z:0},setPosition(x,y,z){this.position={x,y,z};}};
 n.footer=[node];const view=new FreePanelView(n);view.update(true,7);assert.equal(node.position.y,-603);
 view.update(true,6);assert.equal(node.position.y,-603);view.update(false,0);assert.deepEqual(node.position,{x:12,y:-439,z:0});
});
