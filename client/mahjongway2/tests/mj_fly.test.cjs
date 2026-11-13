const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'../assets');
const load=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const prefab='resources/mahjong_effects/mj_fly.prefab';
function child(data,node,name){return (node._children||[]).map(r=>data[r.__id__]).find(n=>n._name===name);}
test('mj_fly retains five real tile hierarchies, all animation targets and reference overrides',()=>{
 const data=load(prefab),root=data[data[0].data.__id__];
 const expected={'cell':[-225,246,.7],'cell-001':[236,273,.7],'cell-002':[-136,290,.7],'cell-003':[134,354,.7],'cell-004':[-35,414,.7]};
 for(const [name,[x,y,scale]] of Object.entries(expected)){
  const tile=child(data,root,name);assert.ok(tile,`${name} must not be an empty prefab placeholder`);
  assert.deepEqual([tile._lpos.x,tile._lpos.y,tile._lscale.x],[x,y,scale]);
  assert.equal(tile._active,false);
  const bg=child(data,tile,'symbol_bg');assert.ok(bg,`${name}/symbol_bg`);
  const face=bg._components.map(r=>data[r.__id__]).find(c=>c.__type__==='cc.Sprite');
  assert.equal(face._spriteFrame.__uuid__,'425d6d31-ad14-463f-9f01-e1fa6658ffea@b2afe',`${name} flying tile must use gold background`);
  const visuals=bg._children.map(r=>data[r.__id__]);
  assert.ok(visuals.some(n=>n._active&&n._components.some(r=>data[r.__id__].__type__==='cc.Sprite')),`${name} visible tile face`);
 }
 for(const obj of data){
  if(obj.__type__==='cc.Node')assert.ok(obj._name,'no unexpanded native prefab nodes');
  if(obj.node)assert.ok(obj.__type__.startsWith('cc.'),'visual effect cannot depend on vendor gameplay scripts');
 }
});
