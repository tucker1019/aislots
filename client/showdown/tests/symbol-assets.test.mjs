import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../assets/',import.meta.url);
const scene=JSON.parse(fs.readFileSync(new URL('wildbountyshowdown/WBSGameScene.scene',root),'utf8'));
const layer=scene.find(item=>item.CellSp);
const names=new Map();
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.meta')){const m=JSON.parse(fs.readFileSync(p,'utf8'));names.set(m.uuid,p);for(const sub of Object.values(m.subMetas||{}))names.set(sub.uuid,sub.name);}}}
scan(new URL(root).pathname);
test('native animation and static sprites resolve the same server symbol IDs, including gold',()=>{
 const expected=['h_bandit','h_gun','h_hat','h_whisky','l_a','l_k','l_q','l_j','s_wild','s_scatter'];
 for(let id=1;id<=10;id++){
  assert.ok(names.get(layer.CellSp[id]?.__uuid__)?.includes(expected[id-1]),`Spine symbol ${id}: ${names.get(layer.CellSp[id]?.__uuid__)}`);
  assert.equal(names.get(layer.CellSprNor[id].__uuid__),expected[id-1]);
 }
});
