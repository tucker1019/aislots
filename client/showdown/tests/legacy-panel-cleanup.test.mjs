import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=new URL('../',import.meta.url),assets=new URL('assets/',root);
const manifest=JSON.parse(fs.readFileSync(new URL('docs/native-panel-cleanup.json',root)));
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
test('legacy panel assets and paired metadata are removed, shared assets remain',()=>{
 assert.equal(manifest.removedAssetCount,41);
 for(const file of manifest.removedAssets){assert.equal(fs.existsSync(new URL(file,assets)),false,file);assert.equal(fs.existsSync(new URL(file+'.meta',assets)),false,file+'.meta');}
 for(const file of manifest.retainedSharedAssets){assert.ok(fs.existsSync(new URL(file,assets)),file);assert.ok(fs.existsSync(new URL(file+'.meta',assets)),file+'.meta');}
});
test('remaining serialized assets do not reference any deleted UUID or script class',()=>{
 for(const file of files(assets.pathname).filter(p=>/\.(scene|prefab|anim|mtl|json|meta)$/.test(p))){const text=fs.readFileSync(file,'utf8');for(const id of [...manifest.removedUUIDs,...manifest.removedScriptTypes])assert.ok(!text.includes(id),`${file} references ${id}`);}
});
test('scene indices stay valid after removing loading instance and obsolete native mask',()=>{
 const scene=JSON.parse(fs.readFileSync(new URL('wildbountyshowdown/WBSGameScene.scene',assets)));
 const check=v=>{if(Array.isArray(v))v.forEach(check);else if(v&&typeof v==='object'){if('__id__'in v)assert.ok(Number.isInteger(v.__id__)&&v.__id__>=0&&v.__id__<scene.length);Object.values(v).forEach(check);}};check(scene);
 const text=JSON.stringify(scene);for(const name of ['loadingLayer','loadingPagePrefab','panelAutoPrefab','panelBalancePrefab','panelBetPrefab','panelRulePrefab'])assert.ok(!text.includes(name),name);
 const menu=scene.find(n=>n.__type__==='cc.Node'&&n._name==='node_popup_menu');assert.deepEqual(menu._children,[]);assert.ok(menu._components.every(r=>scene[r.__id__].__type__!=='cc.BlockInputEvents'));
});
